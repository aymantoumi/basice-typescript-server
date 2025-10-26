import type { Request, Response } from 'express';
import { 
  orders, 
  products, 
  users, 
  orderItems 
} from "../db/schema.ts";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import jwt from 'jsonwebtoken';

const db = drizzle(process.env.DATABASE_URL!);
const JWT_SECRET = process.env.JWT_SECRET || 'my-secret-key';

interface OrderItem {
  productId: number;
  quantity: number;
}

interface CreateOrderRequest {
  customerEmail: string;
  items: OrderItem[];
}

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

    const { customerEmail, items }: CreateOrderRequest = req.body;

    if (!customerEmail || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        error: "Customer email and items array are required" 
      });
    }

    let subtotal = 0;
    const orderItemsData = [];

    // Validate products and calculate total
    for (const item of items) {
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
          error: `Insufficient inventory for product ${product.name}` 
        });
      }

      const price = parseFloat(product.price?.toString() || '0');
      const itemTotal = price * item.quantity;
      subtotal += itemTotal;

      orderItemsData.push({
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        price: price.toString(),
      });
    }

    const taxAmount = subtotal * 0.1;
    const shippingAmount = 10.00; 
    const total = subtotal + taxAmount + shippingAmount;

    const result = await db.transaction(async (tx) => {
      // Create order
      const [newOrder] = await tx
        .insert(orders)
        .values({
          userId: userId,
          customerEmail,
          subtotal: subtotal.toString(),
          taxAmount: taxAmount.toString(),
          shippingAmount: shippingAmount.toString(),
          total: total.toString(),
          status: 'pending',
        })
        .returning();

      // Create order items
      const orderItemsWithOrderId = orderItemsData.map(item => ({
        ...item,
        orderId: newOrder.id,
      }));

      const insertedOrderItems = await tx
        .insert(orderItems)
        .values(orderItemsWithOrderId)
        .returning();

      // Update product quantities
      for (const item of items) {
        await tx
          .update(products)
          .set({ 
            quantity: products.quantity - item.quantity 
          })
          .where(eq(products.id, item.productId));
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
    const ordersData = await db
      .select({
        order: orders,
        user: users,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id));

    const ordersWithItems = await Promise.all(
      ordersData.map(async (orderData) => {
        const orderItemsData = await db
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, orderData.order.id))
          .leftJoin(products, eq(orderItems.productId, products.id));

        return {
          id: orderData.order.id,
          status: orderData.order.status,
          total: orderData.order.total,
          orderDate: orderData.order.createdAt,
          customerEmail: orderData.order.customerEmail,
          user: orderData.user ? {
            id: orderData.user.id,
            name: orderData.user.name,
            email: orderData.user.email
          } : null,
          items: orderItemsData.map(oi => ({
            id: oi.order_items.id,
            productName: oi.order_items.productName,
            quantity: oi.order_items.quantity,
            price: oi.order_items.price,
            product: oi.products ? {
              id: oi.products.id,
              name: oi.products.name,
              image: oi.products.image,
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
        order: orders,
        user: users,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(eq(orders.id, order_id))
      .limit(1);

    if (orderData.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderItemsData = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order_id))
      .leftJoin(products, eq(orderItems.productId, products.id));

    const formattedOrder = {
      id: orderData[0].order.id,
      status: orderData[0].order.status,
      subtotal: orderData[0].order.subtotal,
      taxAmount: orderData[0].order.taxAmount,
      shippingAmount: orderData[0].order.shippingAmount,
      total: orderData[0].order.total,
      orderDate: orderData[0].order.createdAt,
      customerEmail: orderData[0].order.customerEmail,
      user: orderData[0].user ? {
        id: orderData[0].user.id,
        name: orderData[0].user.name,
        email: orderData[0].user.email
      } : null,
      items: orderItemsData.map(oi => ({
        id: oi.order_items.id,
        productName: oi.order_items.productName,
        quantity: oi.order_items.quantity,
        price: oi.order_items.price,
        product: oi.products ? {
          id: oi.products.id,
          name: oi.products.name,
          description: oi.products.description,
          image: oi.products.image,
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
      .from(users)
      .where(eq(users.id, user_id))
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const ordersData = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, user_id))
      .orderBy(orders.createdAt);

    const ordersWithItems = await Promise.all(
      ordersData.map(async (order) => {
        const orderItemsData = await db
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, order.id))
          .leftJoin(products, eq(orderItems.productId, products.id));

        return {
          id: order.id,
          status: order.status,
          total: order.total,
          orderDate: order.createdAt,
          items: orderItemsData.map(oi => ({
            id: oi.order_items.id,
            productName: oi.order_items.productName,
            quantity: oi.order_items.quantity,
            price: oi.order_items.price,
            product: oi.products ? {
              id: oi.products.id,
              name: oi.products.name,
              image: oi.products.image,
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
    const { status }: { status?: string } = req.body;

    if (isNaN(order_id)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const existingOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.id, order_id))
      .limit(1);

    if (existingOrder.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const updateData: any = {};
    
    if (status && ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].includes(status)) {
      updateData.status = status;
    }

    updateData.updatedAt = new Date();

    const result = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, order_id))
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
    const { productId, quantity }: OrderItem = req.body;

    if (isNaN(order_id)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const existingOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.id, order_id))
      .limit(1);

    if (existingOrder.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if order can be modified
    if (['shipped', 'delivered', 'cancelled'].includes(existingOrder[0].status!)) {
      return res.status(400).json({ error: 'Cannot modify order in current status' });
    }

    const productResults = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (productResults.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResults[0];
    const price = parseFloat(product.price?.toString() || '0');

    // Check if item already exists in order
    const existingOrderItem = await db
      .select()
      .from(orderItems)
      .where(
        and(
          eq(orderItems.orderId, order_id),
          eq(orderItems.productId, productId)
        )
      )
      .limit(1);

    if (existingOrderItem.length > 0) {
      return res.status(400).json({ error: 'Product already exists in this order' });
    }

    const result = await db
      .insert(orderItems)
      .values({
        orderId: order_id,
        productId,
        productName: product.name,
        quantity: quantity || 1,
        price: price.toString(),
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
      .delete(orderItems)
      .where(
        and(
          eq(orderItems.orderId, order_id),
          eq(orderItems.id, order_item_id)
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
      .from(orders)
      .where(eq(orders.id, order_id))
      .limit(1);

    if (existingOrder.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(orderItems)
        .where(eq(orderItems.orderId, order_id));

      await tx
        .delete(orders)
        .where(eq(orders.id, order_id));
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