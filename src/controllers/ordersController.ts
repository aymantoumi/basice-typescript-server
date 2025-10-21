import type { Request, Response } from 'express';
import { ordersTable, productsTable, usersTable, orderProductsTable } from "../db/schema.ts";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import jwt from 'jsonwebtoken';

const db = drizzle(process.env.DATABASE_URL!);
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface OrderProduct {
  product_id: number;
  quantity?: number || 1;
}

interface CreateOrderRequest {
  user_address: string;
  products: OrderProduct[];
}

type OrderUpdatePayload = Partial<CreateOrderRequest>;

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

export const createOrder = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { user_address, products }: CreateOrderRequest = req.body;

    if (!user_address || !products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ 
        error: "User address and products array are required" 
      });
    }

    const productIds = products.map(p => p.product_id);
    const existingProducts = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, productIds[0]));

    if (existingProducts.length === 0) {
      return res.status(404).json({ error: "One or more products not found" });
    }

    const result = await db.transaction(async (tx) => {
      const [newOrder] = await tx
        .insert(ordersTable)
        .values({
          user_id: userId,
          user_address: user_address,
        })
        .returning();

      const orderProductsData = products.map(product => ({
        order_id: newOrder.id,
        product_id: product.product_id,
        quantity: product.quantity || 1,
      }));

      const insertedOrderProducts = await tx
        .insert(orderProductsTable)
        .values(orderProductsData)
        .returning();

      return {
        order: newOrder,
        orderProducts: insertedOrderProducts,
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
      .leftJoin(usersTable, eq(ordersTable.user_id, usersTable.id));

    const ordersWithProducts = await Promise.all(
      orders.map(async (orderData) => {
        const orderProducts = await db
          .select({
            product: productsTable,
            quantity: orderProductsTable.quantity,
          })
          .from(orderProductsTable)
          .where(eq(orderProductsTable.order_id, orderData.order.id))
          .leftJoin(productsTable, eq(orderProductsTable.product_id, productsTable.id));

        return {
          id: orderData.order.id,
          user_address: orderData.order.user_address,
          order_date: orderData.order.order_date,
          user: orderData.user ? {
            id: orderData.user.id,
            name: orderData.user.name,
            email: orderData.user.email
          } : null,
          products: orderProducts.map(op => ({
            id: op.product?.id,
            name: op.product?.name,
            price: op.product?.price,
            description: op.product?.description,
            quantity: op.quantity
          }))
        };
      })
    );

    return res.json({ orders: ordersWithProducts });
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
      .leftJoin(usersTable, eq(ordersTable.user_id, usersTable.id))
      .where(eq(ordersTable.id, order_id))
      .limit(1);

    if (orderData.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderProducts = await db
      .select({
        product: productsTable,
        quantity: orderProductsTable.quantity,
      })
      .from(orderProductsTable)
      .where(eq(orderProductsTable.order_id, order_id))
      .leftJoin(productsTable, eq(orderProductsTable.product_id, productsTable.id));

    const formattedOrder = {
      id: orderData[0].order.id,
      user_address: orderData[0].order.user_address,
      order_date: orderData[0].order.order_date,
      user: orderData[0].user ? {
        id: orderData[0].user.id,
        name: orderData[0].user.name,
        email: orderData[0].user.email
      } : null,
      products: orderProducts.map(op => ({
        id: op.product?.id,
        name: op.product?.name,
        price: op.product?.price,
        description: op.product?.description,
        quantity: op.quantity
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
      .select({
        order: ordersTable,
      })
      .from(ordersTable)
      .where(eq(ordersTable.user_id, user_id));

    const ordersWithProducts = await Promise.all(
      orders.map(async (orderData) => {
        const orderProducts = await db
          .select({
            product: productsTable,
            quantity: orderProductsTable.quantity,
          })
          .from(orderProductsTable)
          .where(eq(orderProductsTable.order_id, orderData.order.id))
          .leftJoin(productsTable, eq(orderProductsTable.product_id, productsTable.id));

        return {
          id: orderData.order.id,
          user_address: orderData.order.user_address,
          order_date: orderData.order.order_date,
          products: orderProducts.map(op => ({
            id: op.product?.id,
            name: op.product?.name,
            price: op.product?.price,
            description: op.product?.description,
            quantity: op.quantity
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
      orders: ordersWithProducts 
    });
  } catch (error) {
    console.error('Get orders by user ID error:', error);
    return res.status(500).json({ error: 'Failed to fetch user orders' });
  }
}

export const updateOrder = async (req: Request, res: Response) => {
  try {
    const order_id = parseInt(req.params.order_id);
    const { user_address }: OrderUpdatePayload = req.body;

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
    
    if (user_address !== undefined) {
      updateData.user_address = user_address;
    }

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
    const { product_id, quantity }: OrderProduct = req.body;

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

    const product = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, product_id))
      .limit(1);

    if (product.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const existingOrderProduct = await db
      .select()
      .from(orderProductsTable)
      .where(
        eq(orderProductsTable.order_id, order_id) &&
        eq(orderProductsTable.product_id, product_id)
      )
      .limit(1);

    if (existingOrderProduct.length > 0) {
      return res.status(400).json({ error: 'Product already exists in this order' });
    }

    const result = await db
      .insert(orderProductsTable)
      .values({
        order_id,
        product_id,
        quantity: quantity || 1,
      })
      .returning();

    return res.status(201).json({
      message: 'Product added to order successfully',
      orderProduct: result[0]
    });

  } catch (error) {
    console.error('Add product to order error:', error);
    return res.status(500).json({ error: 'Failed to add product to order' });
  }
}

export const removeProductFromOrder = async (req: Request, res: Response) => {
  try {
    const order_id = parseInt(req.params.order_id);
    const product_id = parseInt(req.params.product_id);

    if (isNaN(order_id) || isNaN(product_id)) {
      return res.status(400).json({ error: 'Invalid order ID or product ID' });
    }

    const result = await db
      .delete(orderProductsTable)
      .where(
        eq(orderProductsTable.order_id, order_id) &&
        eq(orderProductsTable.product_id, product_id)
      )
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: 'Product not found in order' });
    }

    return res.json({
      message: 'Product removed from order successfully',
      removedOrderProduct: result[0]
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
        .delete(orderProductsTable)
        .where(eq(orderProductsTable.order_id, order_id));

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
