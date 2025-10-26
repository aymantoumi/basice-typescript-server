import type { Request, Response } from 'express';
import { users } from '../db/schema.ts';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe'
import dotenv from 'dotenv'

dotenv.config();
const db = drizzle(process.env.DATABASE_URL!)
const stripe = new Stripe(process.env.STRIPE_PRIVATE_KEY!)

interface Cart {
    _id: number;
    name: String;
    price: number;
    quantity: number;
}

export async function stripeCheckOut(req: Request, res: Response) {
    const { cart, user_email: account } = req.body;
    if (!cart || !Array.isArray(cart) || cart.length === 0) {
        return res.status(400).json({ error: 'Invalid or empty cart' });
    }
    if (!account || typeof account !== 'string') {
        return res.status(400).json({ error: 'User email is required' });
    }

    try {
        const accountExists = await db.select().from(users).where(eq(users.email, account));
        if (accountExists.length === 0) {
            return res.status(404).json({ error: 'The account doesn\'t exist' });
        }

        const cartItems: Stripe.Checkout.SessionCreateParams.LineItem[] = cart.map((item) => ({
            price_data: {
                currency: "mad",
                product_data: {
                    name: item?.name || 'Unknown Product',
                },
                unit_amount: Math.round(item?.price * 100),
            },
            quantity: item?.quantity || 1,
        }));

        const session = await stripe.checkout.sessions.create({
            currency: "mad",
            mode: "payment",
            line_items: cartItems,
            success_url: `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.APP_URL}/cancel?session_id={CHECKOUT_SESSION_ID}`,
            customer_email: account,
            metadata: { email: account },
        });

        res.status(200).json({
            status: "success",
            sessionId: session.id,
            url: session.url, 
        });

    } catch (error: any) {
        console.error("Stripe Checkout Error:", error);
        res.status(500).json({ 
            error: 'An error occurred during checkout',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined 
        });
    }
}