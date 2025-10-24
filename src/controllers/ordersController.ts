import type { Request, Response } from 'express';
import { 
  ordersTable, 
  productsTable, 
  usersTable, 
  orderItemsTable, 
  productVariantsTable,
  orderStatusEnum,
  paymentStatusEnum 
} from "../db/schema.ts";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import jwt from 'jsonwebtoken';

const db = drizzle(process.env.DATABASE_URL!);
const JWT_SECRET = process.env.JWT_SECRET || 'my-secret-key';

interface OrderItem {
  productId: number;
  variantId?: number;
  quantity: number;
}

interface CreateOrderRequest {
  customerEmail: string;
  customerPhone?: string;
  shippingAddress: {
    firstName: string;
    lastName: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  billingAddress?: {
    firstName: string;
    lastName: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  items: OrderItem[];
  shippingMethod?: string;
  paymentMethod?: string;
}

type OrderUpdatePayload = Partial<{
  status: string;
  paymentStatus: string;
  shippingAddress: any;
  trackingNumber: string;
  shippingMethod: string;
}>;

function getUserIdFromToken(req: Request): number | null {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded.userId;
  } catch (error) {
    return null;
  }
}

function generateOrderNumber(): string {
  return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const createOrder = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { 
      customerEmail, 
      customerPhone, 
      shippingAddress, 
      billingAddress, 
      items, 
      shippingMethod, 
      paymentMethod 
    }: CreateOrderRequest = req.body;

    if (!customerEmail || !shippingAddress || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        error: "Customer email, shipping address, and items array are required" 
      });
    }

    const { firstName, lastName, address1, city, state, zipCode, country } = shippingAddress;
    if (!firstName || !lastName || !address1 || !city || !state || !zipCode || !country) {
      return res.status(400).json({ 
        error: "Complete shipping address is required" 
      });
    }

    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      let product: any;
      let price = 0;

      if (item.variantId) {
        const variants = await db
          .select()
          .from(productVariantsTable)
          .where(eq(productVariantsTable.id, item.variantId))
          .limit(1);

        if (variants.length === 0) {
          return res.status(404).json({ error: `Variant with ID ${item.variantId} not found` });
        }

        const variant = variants[0];
        product = await db
          .select()
          .from(productsTable)
          .where(eq(productsTable.id, variant.productId))
          .limit(1);

        if (product.length === 0) {
          return res.status(404).json({ error: `Product for variant ${item.variantId} not found` });
        }

        price = parseFloat(variant.price?.toString() || '0');
      } else {
        const products = await db
          .select()
          .from(productsTable)
          .where(eq(productsTable.id, item.productId))
          .limit(1);

        if (products.length === 0) {
          return res.status(404).json({ error: `Product with ID ${item.productId} not found` });
        }

        product = products[0];
        price = parseFloat(product.price?.toString() || '0');
      }

      if (product.trackQuantity && product.quantity < item.quantity && !product.allowBackorder) {
        return res.status(400).json({ 
          error: `Insufficient inventory for product ${product.name}` 
        });
      }

      const itemTotal = price * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        productId: item.productId,
        variantId: item.variantId,
        productName: product.name,
        productSku: product.sku,
        variantOptions: item.variantId ? {} : undefined, 
        quantity: item.quantity,
        price: price.toString(),
        comparePrice: product.comparePrice?.toString(),
      });
    }

    const taxAmount = subtotal * 0.1;x
    const shippingAmount = 10.00; 
    const total = subtotal + taxAmount + shippingAmount;

    const result = await db.transaction(async (tx) => {
      // Create order
      const [newOrder] = await tx
        .insert(ordersTable)
        .values({
          orderNumber: generateOrderNumber(),
          userId: userId,
          customerEmail,
          customerPhone,
          shippingAddress,
          billingAddress: billingAddress || shippingAddress,
          subtotal: subtotal.toString(),
          taxAmount: taxAmount.toString(),
          shippingAmount: shippingAmount.toString(),
          total: total.toString(),
          shippingMethod,
          paymentMethod,
          status: 'pending',
          paymentStatus: 'pending',
        })
        .returning();

      const orderItemsData = orderItems.map(item => ({
        orderId: newOrder.id,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        productSku: item.productSku,
        variantOptions: item.variantOptions,
        quantity: item.quantity,
        price: item.price,
        comparePrice: item.comparePrice,
      }));

      const insertedOrderItems = await tx
        .insert(orderItemsTable)
        .values(orderItemsData)
        .returning();

      for (const item of items) {
        if (item.variantId) {
          await tx
            .update(productVariantsTable)
            .set({ 
              quantity: productVariantsTable.quantity - item.quantity 
            })
            .where(eq(productVariantsTable.id, item.variantId));
        } else {
          await tx
            .update(productsTable)
            .set({ 
              quantity: productsTable.quantity - item.quantity 
            })
            .where(eq(productsTable.id, item.productId));
        }
      }

      return {
        order: newOrder,
        orderItems: insertedOrderItems,
      };
    });

    return res.status(201).json({
      message: "Order created successfully",
      data: result,
    });

  } catch (error) {
    console.error("Error creating order:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    
    const orders = await db
      .select({
        order: ordersTable,
        user: usersTable,
      })
      .from(ordersTable)
      .leftJoin(usersTable, eq(ordersTable.userId, usersTable.id));

    const ordersWithItems = await Promise.all(
      orders.map(async (orderData) => {
        const orderItems = await db
          .select()
          .from(orderItemsTable)
          .where(eq(orderItemsTable.orderId, orderData.order.id))
          .leftJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
          .leftJoin(productVariantsTable, eq(orderItemsTable.variantId, productVariantsTable.id));

        return {
          id: orderData.order.id,
          orderNumber: orderData.order.orderNumber,
          status: orderData.order.status,
          paymentStatus: orderData.order.paymentStatus,
          total: orderData.order.total,
          orderDate: orderData.order.orderDate,
          customerEmail: orderData.order.customerEmail,
          shippingAddress: orderData.order.shippingAddress,
          user: orderData.user ? {
            id: orderData.user.id,
            name: orderData.user.name,
            email: orderData.user.email
          } : null,
          items: orderItems.map(oi => ({
            id: oi.order_items.id,
            productName: oi.order_items.productName,
            productSku: oi.order_items.productSku,
            variantOptions: oi.order_items.variantOptions,
            quantity: oi.order_items.quantity,
            price: oi.order_items.price,
            product: oi.products ? {
              id: oi.products.id,
              name: oi.products.name,
              mainImage: oi.products.mainImage,
            } : null,
            variant: oi.product_variants ? {
              id: oi.product_variants.id,
              options: oi.product_variants.options,
            } : null,
          }))
        };
      })
    );

    return res.json({ orders: ordersWithItems });
  } catch (error) {
    console.error('Get all orders error:', error);
    return res.status(500).json({ error: 'Failed to fetch orders' });
  }
}

export const getOrderById = async (req: Request, res: Response) => {
  try {
    const order_id = parseInt(req.params.order_id);

    if (isNaN(order_id)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const orderData = await db
      .select({
        order: ordersTable,
        user: usersTable,
      })
      .from(ordersTable)
      .leftJoin(usersTable, eq(ordersTable.userId, usersTable.id))
      .where(eq(ordersTable.id, order_id))
      .limit(1);

    if (orderData.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderItems = await db
      .select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, order_id))
      .leftJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
      .leftJoin(productVariantsTable, eq(orderItemsTable.variantId, productVariantsTable.id));

    const formattedOrder = {
      id: orderData[0].order.id,
      orderNumber: orderData[0].order.orderNumber,
      status: orderData[0].order.status,
      paymentStatus: orderData[0].order.paymentStatus,
      subtotal: orderData[0].order.subtotal,
      taxAmount: orderData[0].order.taxAmount,
      shippingAmount: orderData[0].order.shippingAmount,
      total: orderData[0].order.total,
      orderDate: orderData[0].order.orderDate,
      customerEmail: orderData[0].order.customerEmail,
      customerPhone: orderData[0].order.customerPhone,
      shippingAddress: orderData[0].order.shippingAddress,
      billingAddress: orderData[0].order.billingAddress,
      shippingMethod: orderData[0].order.shippingMethod,
      paymentMethod: orderData[0].order.paymentMethod,
      trackingNumber: orderData[0].order.trackingNumber,
      user: orderData[0].user ? {
        id: orderData[0].user.id,
        name: orderData[0].user.name,
        email: orderData[0].user.email
      } : null,
      items: orderItems.map(oi => ({
        id: oi.order_items.id,
        productName: oi.order_items.productName,
        productSku: oi.order_items.productSku,
        variantOptions: oi.order_items.variantOptions,
        quantity: oi.order_items.quantity,
        price: oi.order_items.price,
        comparePrice: oi.order_items.comparePrice,
        product: oi.products ? {
          id: oi.products.id,
          name: oi.products.name,
          description: oi.products.description,
          mainImage: oi.products.mainImage,
        } : null,
        variant: oi.product_variants ? {
          id: oi.product_variants.id,
          options: oi.product_variants.options,
        } : null,
      }))
    };

    return res.json({ order: formattedOrder });
  } catch (error) {
    console.error('Get order by ID error:', error);
    return res.status(500).json({ error: 'Failed to fetch order' });
  }
}

export const getOrdersByUserId = async (req: Request, res: Response) => {
  try {
    const user_id = parseInt(req.params.user_id);

    if (isNaN(user_id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, user_id))
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const orders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.userId, user_id))
      .orderBy(ordersTable.orderDate);

    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const orderItems = await db
          .select()
          .from(orderItemsTable)
          .where(eq(orderItemsTable.orderId, order.id))
          .leftJoin(productsTable, eq(orderItemsTable.productId, productsTable.id));

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
          total: order.total,
          orderDate: order.orderDate,
          items: orderItems.map(oi => ({
            id: oi.order_items.id,
            productName: oi.order_items.productName,
            quantity: oi.order_items.quantity,
            price: oi.order_items.price,
            product: oi.products ? {
              id: oi.products.id,
              name: oi.products.name,
              mainImage: oi.products.mainImage,
            } : null,
          }))
        };
      })
    );

    return res.json({ 
      user: {
        id: user[0].id,
        name: user[0].name,
        email: user[0].email
      },
      orders: ordersWithItems 
    });
  } catch (error) {
    console.error('Get orders by user ID error:', error);
    return res.status(500).json({ error: 'Failed to fetch user orders' });
  }
}

export const updateOrder = async (req: Request, res: Response) => {
  try {
    const order_id = parseInt(req.params.order_id);
    const { status, paymentStatus, shippingAddress, trackingNumber, shippingMethod }: OrderUpdatePayload = req.body;

    if (isNaN(order_id)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const existingOrder = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, order_id))
      .limit(1);

    if (existingOrder.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const updateData: Partial<typeof ordersTable.$inferInsert> = {};
    
    if (status && Object.values(orderStatusEnum.enumValues).includes(status as any)) {
      updateData.status = status as any;
    }
    
    if (paymentStatus && Object.values(paymentStatusEnum.enumValues).includes(paymentStatus as any)) {
      updateData.paymentStatus = paymentStatus as any;
    }
    
    if (shippingAddress) {
      updateData.shippingAddress = shippingAddress;
    }
    
    if (trackingNumber) {
      updateData.trackingNumber = trackingNumber;
    }
    
    if (shippingMethod) {
      updateData.shippingMethod = shippingMethod;
    }

    // Set timestamps for status changes
    if (status === 'shipped' && existingOrder[0].status !== 'shipped') {
      updateData.shippedAt = new Date();
    } else if (status === 'delivered' && existingOrder[0].status !== 'delivered') {
      updateData.deliveredAt = new Date();
    } else if (status === 'cancelled' && existingOrder[0].status !== 'cancelled') {
      updateData.cancelledAt = new Date();
    }

    updateData.updatedAt = new Date();

    const result = await db
      .update(ordersTable)
      .set(updateData)
      .where(eq(ordersTable.id, order_id))
      .returning();

    return res.json({
      message: 'Order updated successfully',
      order: result[0]
    });

  } catch (error) {
    console.error('Update order error:', error);
    return res.status(500).json({ error: 'Failed to update order' });
  }
}

export const addProductToOrder = async (req: Request, res: Response) => {
  try {
    const order_id = parseInt(req.params.order_id);
    const { productId, variantId, quantity }: OrderItem = req.body;

    if (isNaN(order_id)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const existingOrder = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, order_id))
      .limit(1);

    if (existingOrder.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if order can be modified
    if (['shipped', 'delivered', 'cancelled'].includes(existingOrder[0].status!)) {
      return res.status(400).json({ error: 'Cannot modify order in current status' });
    }

    let product: any;
    let price = 0;
    let productName = '';
    let productSku = '';

    if (variantId) {
      const variants = await db
        .select()
        .from(productVariantsTable)
        .where(eq(productVariantsTable.id, variantId))
        .limit(1);

      if (variants.length === 0) {
        return res.status(404).json({ error: 'Variant not found' });
      }

      const variant = variants[0];
      const products = await db
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, variant.productId))
        .limit(1);

      if (products.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }

      product = products[0];
      price = parseFloat(variant.price?.toString() || '0');
      productName = product.name;
      productSku = variant.sku || product.sku || '';
    } else {
      const products = await db
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, productId))
        .limit(1);

      if (products.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }

      product = products[0];
      price = parseFloat(product.price?.toString() || '0');
      productName = product.name;
      productSku = product.sku || '';
    }

    // Check if item already exists in order
    const existingOrderItem = await db
      .select()
      .from(orderItemsTable)
      .where(
        and(
          eq(orderItemsTable.orderId, order_id),
          eq(orderItemsTable.productId, productId),
          variantId ? eq(orderItemsTable.variantId, variantId) : undefined as any
        )
      )
      .limit(1);

    if (existingOrderItem.length > 0) {
      return res.status(400).json({ error: 'Product already exists in this order' });
    }

    const result = await db
      .insert(orderItemsTable)
      .values({
        orderId: order_id,
        productId,
        variantId,
        productName,
        productSku,
        quantity: quantity || 1,
        price: price.toString(),
        comparePrice: product.comparePrice?.toString(),
      })
      .returning();

    return res.status(201).json({
      message: 'Product added to order successfully',
      orderItem: result[0]
    });

  } catch (error) {
    console.error('Add product to order error:', error);
    return res.status(500).json({ error: 'Failed to add product to order' });
  }
}

export const removeProductFromOrder = async (req: Request, res: Response) => {
  try {
    const order_id = parseInt(req.params.order_id);
    const order_item_id = parseInt(req.params.order_item_id);

    if (isNaN(order_id) || isNaN(order_item_id)) {
      return res.status(400).json({ error: 'Invalid order ID or order item ID' });
    }

    const result = await db
      .delete(orderItemsTable)
      .where(
        and(
          eq(orderItemsTable.orderId, order_id),
          eq(orderItemsTable.id, order_item_id)
        )
      )
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: 'Order item not found' });
    }

    return res.json({
      message: 'Product removed from order successfully',
      removedOrderItem: result[0]
    });

  } catch (error) {
    console.error('Remove product from order error:', error);
    return res.status(500).json({ error: 'Failed to remove product from order' });
  }
}

export const deleteOrder = async (req: Request, res: Response) => {
  try {
    const order_id = parseInt(req.params.order_id);

    if (isNaN(order_id)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const existingOrder = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, order_id))
      .limit(1);

    if (existingOrder.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(orderItemsTable)
        .where(eq(orderItemsTable.orderId, order_id));

      await tx
        .delete(ordersTable)
        .where(eq(ordersTable.id, order_id));
    });

    return res.json({ 
      message: 'Order deleted successfully',
      deletedOrderId: order_id
    });

  } catch (error) {
    console.error('Delete order error:', error);
    return res.status(500).json({ error: 'Failed to delete order' });
  }
}