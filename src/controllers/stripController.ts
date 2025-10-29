import type { Request, Response } from 'express';
import { users, products, orders, orderItems } from '../db/schema.ts';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();
const db = drizzle(process.env.DATABASE_URL!);
const stripe = new Stripe(process.env.STRIPE_PRIVATE_KEY!, {
  apiVersion: '2025-09-30.clover', 
});

interface CartItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

export async function stripeCheckOut(req: Request, res: Response) {
  const { cart, user_email } = req.body;
  
  if (!cart || !Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ error: 'Invalid or empty cart' });
  }
  if (!user_email || typeof user_email !== 'string') {
    return res.status(400).json({ error: 'User email is required' });
  }

  try {
    // Verify user exists
    const accountExists = await db.select().from(users).where(eq(users.email, user_email));
    if (accountExists.length === 0) {
      return res.status(404).json({ error: 'User account not found' });
    }

    const user = accountExists[0];

    // Validate cart items and check inventory
    let totalAmount = 0;
    const validatedCartItems: CartItem[] = [];

    for (const item of cart) {
      if (!item.productId || !item.quantity) {
        return res.status(400).json({ error: 'Invalid cart item: missing productId or quantity' });
      }

      const productResults = await db
        .select()
        .from(products)
        .where(eq(products.id, item.productId))
        .limit(1);

      if (productResults.length === 0) {
        return res.status(404).json({ error: `Product with ID ${item.productId} not found` });
      }

      const product = productResults[0];

      // Check inventory
      if (product.quantity < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient inventory for ${product.name}. Available: ${product.quantity}` 
        });
      }

      const price = parseFloat(product.price?.toString() || '0');
      totalAmount += price * item.quantity;

      validatedCartItems.push({
        productId: item.productId,
        name: product.name,
        price: price,
        quantity: item.quantity,
        image: product.image || undefined
      });
    }

    // Create Stripe checkout session
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = validatedCartItems.map((item) => ({
      price_data: {
        currency: "usd", // Changed from "mad" to "usd" for better testing
        product_data: {
          name: item.name,
          images: item.image ? [item.image] : undefined,
        },
        unit_amount: Math.round(item.price * 100), // Convert to cents
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/cancel?session_id={CHECKOUT_SESSION_ID}`,
      customer_email: user_email,
      metadata: {
        userId: user.id.toString(),
        userEmail: user_email,
        cartItems: JSON.stringify(validatedCartItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity
        })))
      },
    });

    res.status(200).json({
      status: "success",
      sessionId: session.id,
      url: session.url,
      totalAmount: totalAmount
    });

  } catch (error: any) {
    console.error("Stripe Checkout Error:", error);
    res.status(500).json({ 
      error: 'An error occurred during checkout',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
}

// Webhook handler to process successful payments
export async function stripeWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (!endpointSecret) {
      throw new Error('Stripe webhook secret is not configured');
    }

    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    try {
      await handleSuccessfulPayment(session);
      console.log(`Payment successful for session ${session.id}`);
    } catch (error) {
      console.error('Error handling successful payment:', error);
      // Don't return error to Stripe - they'll retry
    }
  }

  res.json({ received: true });
}

// Handle successful payment and create order
async function handleSuccessfulPayment(session: Stripe.Checkout.Session) {
  const userId = parseInt(session.metadata?.userId || '0');
  const userEmail = session.metadata?.userEmail || session.customer_email;
  const cartItems = session.metadata?.cartItems ? JSON.parse(session.metadata.cartItems) : [];

  if (!userId || cartItems.length === 0) {
    throw new Error('Missing required metadata for order creation');
  }

  return await db.transaction(async (tx) => {
    // Calculate order totals
    let subtotal = 0;
    const orderItemsData = [];

    for (const item of cartItems) {
      const productResults = await tx
        .select()
        .from(products)
        .where(eq(products.id, item.productId))
        .limit(1);

      if (productResults.length === 0) {
        throw new Error(`Product ${item.productId} not found`);
      }

      const product = productResults[0];
      const price = parseFloat(product.price?.toString() || '0');
      const itemTotal = price * item.quantity;
      subtotal += itemTotal;

      orderItemsData.push({
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        price: price.toString(),
      });

      // Update product quantity
      await tx
        .update(products)
        .set({ 
          quantity: products.quantity - item.quantity 
        })
        .where(eq(products.id, item.productId));
    }

    const taxAmount = subtotal * 0.1;
    const shippingAmount = 10.00;
    const total = subtotal + taxAmount + shippingAmount;

    // Create order
    const [newOrder] = await tx
      .insert(orders)
      .values({
        userId: userId,
        customerEmail: userEmail,
        subtotal: subtotal.toString(),
        taxAmount: taxAmount.toString(),
        shippingAmount: shippingAmount.toString(),
        total: total.toString(),
        status: 'confirmed',
        paymentMethod: 'stripe',
        transactionId: session.payment_intent as string,
      })
      .returning();

    // Create order items
    const orderItemsWithOrderId = orderItemsData.map(item => ({
      ...item,
      orderId: newOrder.id,
    }));

    await tx
      .insert(orderItems)
      .values(orderItemsWithOrderId);

    return newOrder;
  });
}

// Get checkout session status
export async function getSessionStatus(req: Request, res: Response) {
  const { session_id } = req.params;

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    res.json({
      status: session.status,
      payment_status: session.payment_status,
      customer_email: session.customer_email,
      amount_total: session.amount_total ? session.amount_total / 100 : 0,
      currency: session.currency,
    });
  } catch (error: any) {
    console.error('Error retrieving session:', error);
    res.status(500).json({ error: 'Failed to retrieve session status' });
  }
}