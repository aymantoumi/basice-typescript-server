import type { Request, Response } from 'express';
import { 
  products 
} from "../db/schema.ts"; 
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, desc, asc, like, sql } from 'drizzle-orm'

const db = drizzle(process.env.DATABASE_URL!)

interface ProductPayload {
  name: string;
  description?: string;
  price: string | number;
  quantity?: number;
  image?: string;
}

interface ProductQueryParams {
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

type ProductUpdatePayload = Partial<ProductPayload>;

// Service functions
const getAllProductsService = async (queryParams: ProductQueryParams = {}) => {
  try {
    const {
      search,
      minPrice,
      maxPrice,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = queryParams;

    const offset = (page - 1) * limit;

    let query = db.select().from(products);

    // Apply filters
    if (search) {
      query = query.where(
        like(products.name, `%${search}%`)
      );
    }

    if (minPrice !== undefined) {
      query = query.where(
        sql`${products.price} >= ${minPrice.toString()}`
      );
    }

    if (maxPrice !== undefined) {
      query = query.where(
        sql`${products.price} <= ${maxPrice.toString()}`
      );
    }

    // Apply sorting
    const sortColumn = sortBy === 'price' ? products.price : 
                      sortBy === 'name' ? products.name : 
                      products.createdAt;

    if (sortOrder === 'asc') {
      query = query.orderBy(asc(sortColumn));
    } else {
      query = query.orderBy(desc(sortColumn));
    }

    // Apply pagination
    query = query.limit(limit).offset(offset);

    const productsData = await query;

    // Get total count for pagination
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(products);

    // Apply same filters to count query
    if (search) {
      countQuery = countQuery.where(like(products.name, `%${search}%`));
    }

    const totalResult = await countQuery;
    const total = totalResult[0]?.count || 0;

    return { 
      success: true, 
      data: productsData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Get all products service error:', error);
    return { success: false, error: 'Failed to fetch products' };
  }
}

const getProductByIdService = async (product_id: number) => {
  try {
    const productsData = await db.select()
      .from(products)
      .where(eq(products.id, product_id))
      .limit(1);

    if (productsData.length === 0) {
      return { success: false, error: `Product with id ${product_id} not found` };
    }

    return { success: true, data: productsData[0] };
  } catch (error) {
    console.error('Get product by ID service error:', error);
    return { success: false, error: 'Failed to fetch product' };
  }
}

const createProductService = async (payload: ProductPayload) => {
  try {
    const product = {
      name: payload.name,
      description: payload.description,
      price: payload.price.toString(),
      quantity: payload.quantity || 0,
      image: payload.image,
    };

    const result = await db.insert(products)
      .values(product)
      .returning();

    return { 
      success: true, 
      message: 'Product created successfully', 
      data: result[0] 
    };
    
  } catch (error: any) {
    console.error('Create product service error:', error);
    return { success: false, error: 'Failed to create product' };
  }
}

const updateProductService = async (payload: ProductUpdatePayload, product_id: number) => {
  try {
    const existingProduct = await db
      .select()
      .from(products)
      .where(eq(products.id, product_id))
      .limit(1);

    if (existingProduct.length === 0) {
      return { 
        success: false, 
        error: `No product found with id ${product_id}` 
      };
    }

    const updateData: any = {};

    // Map payload to update data
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.description !== undefined) updateData.description = payload.description;
    if (payload.price !== undefined) updateData.price = payload.price.toString();
    if (payload.quantity !== undefined) updateData.quantity = payload.quantity;
    if (payload.image !== undefined) updateData.image = payload.image;

    updateData.updatedAt = new Date();

    const result = await db
      .update(products)
      .set(updateData)
      .where(eq(products.id, product_id))
      .returning();

    return { 
      success: true, 
      message: 'Product updated successfully', 
      data: result[0] 
    };
  
  } catch (error: any) {
    console.error('Update product service error:', error);
    return { success: false, error: 'Failed to update product' };
  }
}

const deleteProductService = async (product_id: number) => {
  try {
    const existingProduct = await db 
      .select()
      .from(products)
      .where(eq(products.id, product_id))
      .limit(1);

    if (existingProduct.length === 0) {
      return { 
        success: false, 
        error: `Product with id ${product_id} not found` 
      };
    }

    await db
      .delete(products)
      .where(eq(products.id, product_id));

    return { 
      success: true, 
      message: `Product ${product_id} deleted successfully` 
    };

  } catch (error) {
    console.error('Delete product service error:', error);
    return { success: false, error: 'Failed to delete product' };
  }
}

// Express Route Handlers
export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const queryParams: ProductQueryParams = {
      search: req.query.search as string,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as 'asc' | 'desc'
    };

    const result = await getAllProductsService(queryParams);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({ 
      products: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get all products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export const getProductById = async (req: Request, res: Response) => {
  try {
    const product_id = parseInt(req.params.product_id);
    
    if (isNaN(product_id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const result = await getProductByIdService(product_id);
    
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }
    
    res.json({ product: result.data });
  } catch (error) {
    console.error('Get product by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export const createProduct = async (req: Request, res: Response) => {
  try {
    const payload: ProductPayload = req.body;

    // Required fields validation
    if (!payload.name || !payload.price) {
      return res.status(400).json({ 
        error: 'Name and price are required' 
      });
    }

    const result = await createProductService(payload);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.status(201).json({
      message: result.message,
      product: result.data
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const product_id = parseInt(req.params.product_id);
    
    if (isNaN(product_id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const payload: ProductUpdatePayload = req.body;

    const result = await updateProductService(payload, product_id);
    
    if (!result.success) {
      const statusCode = result.error?.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({ error: result.error });
    }
    
    res.json({
      message: result.message,
      product: result.data
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const product_id = parseInt(req.params.product_id);
    
    if (isNaN(product_id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const result = await deleteProductService(product_id);
    
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }
    
    res.json({ message: result.message });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Additional utility endpoints
export const getFeaturedProducts = async (req: Request, res: Response) => {
  try {
    // For simplified version, just return latest products
    const result = await getAllProductsService({
      limit: 8,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({ products: result.data });
  } catch (error) {
    console.error('Get featured products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}