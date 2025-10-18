import type { Request, Response, Application } from 'express';
import { ordersTable, productsTable, usersTable } from "../db/schema.ts";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL!);

type OrderPayload = {
  product_id: number;
  user_id: number;
  quantity: number;
};

type OrderUpdatePayload = Partial<OrderPayload>;

// Create a new order
export const createOrder = async (req: Request, res: Response) => {
  try {
    const { product_id, user_id, quantity }: OrderPayload = req.body;

    // Validate required fields
    if (!product_id || !user_id || !quantity) {
      return res.status(400).json({ 
        error: 'product_id, user_id, and quantity are required' 
      });
    }

    // Check if user exists
    const user = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, user_id))
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if product exists
    const product = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, product_id))
      .limit(1);

    if (product.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Validate quantity
    if (quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }

    // Create order
    const order: typeof ordersTable.$inferInsert = {
      product_id,
      user_id,
      quantity,
    };

    const result = await db.insert(ordersTable)
      .values(order)
      .returning();

    return res.status(201).json({
      message: 'Order created successfully',
      order: result[0]
    });

  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({ error: 'Failed to create order' });
  }
}

// Get all orders
export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const orders = await db
      .select()
      .from(ordersTable)
      .leftJoin(usersTable, eq(ordersTable.user_id, usersTable.id))
      .leftJoin(productsTable, eq(ordersTable.product_id, productsTable.id));

    const formattedOrders = orders.map(order => ({
      id: order.orders.id,
      quantity: order.orders.quantity,
      order_date: order.orders.order_date,
      user: {
        id: order.users?.id,
        name: order.users?.name,
        email: order.users?.email
      },
      product: {
        id: order.products?.id,
        name: order.products?.name,
        price: order.products?.price,
        description: order.products?.description
      }
    }));

    return res.json({ orders: formattedOrders });
  } catch (error) {
    console.error('Get all orders error:', error);
    return res.status(500).json({ error: 'Failed to fetch orders' });
  }
}

// Get order by ID
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const order_id = parseInt(req.params.order_id);

    if (isNaN(order_id)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const orders = await db
      .select()
      .from(ordersTable)
      .leftJoin(usersTable, eq(ordersTable.user_id, usersTable.id))
      .leftJoin(productsTable, eq(ordersTable.product_id, productsTable.id))
      .where(eq(ordersTable.id, order_id))
      .limit(1);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];
    const formattedOrder = {
      id: order.orders.id,
      quantity: order.orders.quantity,
      order_date: order.orders.order_date,
      user: {
        id: order.users?.id,
        name: order.users?.name,
        email: order.users?.email
      },
      product: {
        id: order.products?.id,
        name: order.products?.name,
        price: order.products?.price,
        description: order.products?.description
      }
    };

    return res.json({ order: formattedOrder });
  } catch (error) {
    console.error('Get order by ID error:', error);
    return res.status(500).json({ error: 'Failed to fetch order' });
  }
}

// Get orders by user ID
export const getOrdersByUserId = async (req: Request, res: Response) => {
  try {
    const user_id = parseInt(req.params.user_id);

    if (isNaN(user_id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Check if user exists
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
      .leftJoin(productsTable, eq(ordersTable.product_id, productsTable.id))
      .where(eq(ordersTable.user_id, user_id));

    const formattedOrders = orders.map(order => ({
      id: order.orders.id,
      quantity: order.orders.quantity,
      order_date: order.orders.order_date,
      product: {
        id: order.products?.id,
        name: order.products?.name,
        price: order.products?.price,
        description: order.products?.description
      }
    }));

    return res.json({ 
      user: {
        id: user[0].id,
        name: user[0].name,
        email: user[0].email
      },
      orders: formattedOrders 
    });
  } catch (error) {
    console.error('Get orders by user ID error:', error);
    return res.status(500).json({ error: 'Failed to fetch user orders' });
  }
}

// Update order
export const updateOrder = async (req: Request, res: Response) => {
  try {
    const order_id = parseInt(req.params.order_id);
    const { product_id, user_id, quantity }: OrderUpdatePayload = req.body;

    if (isNaN(order_id)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    // Check if order exists
    const existingOrder = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, order_id))
      .limit(1);

    if (existingOrder.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Prepare update data
    const updateData: OrderUpdatePayload = {};
    
    if (product_id !== undefined) {
      // Check if new product exists
      const product = await db
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, product_id))
        .limit(1);

      if (product.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      updateData.product_id = product_id;
    }

    if (user_id !== undefined) {
      // Check if new user exists
      const user = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, user_id))
        .limit(1);

      if (user.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      updateData.user_id = user_id;
    }

    if (quantity !== undefined) {
      if (quantity <= 0) {
        return res.status(400).json({ error: 'Quantity must be greater than 0' });
      }
      updateData.quantity = quantity;
    }

    // Update order
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

// Delete order
export const deleteOrder = async (req: Request, res: Response) => {
  try {
    const order_id = parseInt(req.params.order_id);

    if (isNaN(order_id)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    // Check if order exists
    const existingOrder = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, order_id))
      .limit(1);

    if (existingOrder.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Delete order
    await db
      .delete(ordersTable)
      .where(eq(ordersTable.id, order_id));

    return res.json({ 
      message: 'Order deleted successfully',
      deletedOrderId: order_id
    });

  } catch (error) {
    console.error('Delete order error:', error);
    return res.status(500).json({ error: 'Failed to delete order' });
  }
}