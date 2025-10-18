import type { Request, Response, Application } from 'express';
import { productsTable } from "../db/schema.ts";
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm'

const db = drizzle(process.env.DATABASE_URL!)

type ProductPayload = {
  name: string;
  price: number;
  description: string;
};

type ProductUpdatePayload = Partial<ProductPayload>;

// Your existing service functions
const getAllProductsService = async () => {
  try {
    const products = await db.select().from(productsTable);
    return { success: true, data: products };
  } catch (error) {
    console.error(error);
    return { success: false, error: 'Failed to fetch products' };
  }
}

const getProductByIdService = async (product_id: number) => {
  try {
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, product_id))
      .limit(1);

    if (products.length === 0) {
      return { success: false, error: `Product with id ${product_id} not found` };
    }

    return { success: true, data: products[0] };
  } catch (error) {
    console.error(error);
    return { success: false, error: 'Failed to fetch product' };
  }
}

const createProductService = async (name: string, price: number, description: string) => {
  try {
    const product: typeof productsTable.$inferInsert = {
      name: name,
      price: price,
      description: description 
    };

    const result = await db.insert(productsTable)
      .values(product)
      .returning();

    return { 
      success: true, 
      message: 'Product created successfully', 
      data: result[0] 
    };
    
  } catch (error) {
    console.error(error);
    return { success: false, error: 'Failed to create product' };
  }
}

const updateProductService = async (payload: ProductUpdatePayload, product_id: number) => {
  try {
    const existingProduct = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, product_id))
      .limit(1);

    if (existingProduct.length === 0) {
      return { 
        success: false, 
        error: `No product found with id ${product_id}` 
      };
    }

    const result = await db
      .update(productsTable)
      .set(payload)
      .where(eq(productsTable.id, product_id))
      .returning();

    return { 
      success: true, 
      message: 'Product updated successfully', 
      data: result[0] 
    };
  
  } catch (error) {
    console.error(error);
    return { success: false, error: 'Failed to update product' };
  }
}

const deleteProductService = async (product_id: number) => {
  try {
    const existingProduct = await db 
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, product_id))
      .limit(1);

    if (existingProduct.length === 0) {
      return { 
        success: false, 
        error: `Product with id ${product_id} not found` 
      };
    }

    await db 
      .delete(productsTable)
      .where(eq(productsTable.id, product_id));

    return { 
      success: true, 
      message: `Product ${product_id} deleted successfully` 
    };

  } catch (error) {
    console.error(error);
    return { success: false, error: 'Failed to delete product' };
  }
}

// Express Route Handlers
export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const result = await getAllProductsService();
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({ products: result.data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export const getProductById = async (req: Request, res: Response) => {
  try {
    const product_id = req.params.product_id;
    
    if (!product_id) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const result = await getProductByIdService(product_id);
    
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }
    
    res.json({ product: result.data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export const createProduct = async (req: Request, res: Response) => {
  try {
    const { name, price, description } = req.body;

    if (!name || !price || !description) {
      return res.status(400).json({ error: 'Name, price, and description are required' });
    }

    const result = await createProductService(name, price, description);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.status(201).json({
      message: result.message,
      product: result.data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const product_id = parseInt(req.params.product_id);
    
    if (isNaN(product_id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const { name, price, description } = req.body;
    const updatePayload: ProductUpdatePayload = {};

    if (name !== undefined) updatePayload.name = name;
    if (price !== undefined) updatePayload.price = price;
    if (description !== undefined) updatePayload.description = description;

    const result = await updateProductService(updatePayload, product_id);
    
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }
    
    res.json({
      message: result.message,
      product: result.data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const product_id = req.params.product_id;
    
    if (!product_id) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const result = await deleteProductService(product_id);
    
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }
    
    res.json({ message: result.message });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}