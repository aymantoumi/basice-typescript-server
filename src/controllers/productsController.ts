import type { Request, Response } from 'express';
import { 
  productsTable, 
  productVariantsTable,
  productCategoryEnum,
  productReviewsTable 
} from "../db/schema.ts";
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, desc, asc, like, sql } from 'drizzle-orm'

const db = drizzle(process.env.DATABASE_URL!)

interface ProductPayload {
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  price: string | number;
  comparePrice?: string | number;
  cost?: string | number;
  sku?: string;
  barcode?: string;
  category: string;
  brand?: string;
  type?: string;
  quantity?: number;
  lowStockThreshold?: number;
  trackQuantity?: boolean;
  allowBackorder?: boolean;
  weight?: string | number;
  length?: string | number;
  width?: string | number;
  height?: string | number;
  metaTitle?: string;
  metaDescription?: string;
  tags?: string[];
  status?: string;
  featured?: boolean;
  mainImage?: string;
  images?: string[];
  attributes?: Record<string, any>;
}

interface ProductQueryParams {
  category?: string;
  brand?: string;
  featured?: boolean;
  status?: string;
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
      category,
      brand,
      featured,
      status,
      search,
      minPrice,
      maxPrice,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = queryParams;

    const offset = (page - 1) * limit;

    let query = db.select().from(productsTable);

    // Apply filters
    if (category) {
      query = query.where(eq(productsTable.category, category as any));
    }

    if (brand) {
      query = query.where(eq(productsTable.brand, brand));
    }

    if (featured !== undefined) {
      query = query.where(eq(productsTable.featured, featured));
    }

    if (status) {
      query = query.where(eq(productsTable.status, status));
    }

    if (search) {
      query = query.where(
        like(productsTable.name, `%${search}%`)
      );
    }

    if (minPrice !== undefined) {
      query = query.where(
        sql`${productsTable.price} >= ${minPrice.toString()}`
      );
    }

    if (maxPrice !== undefined) {
      query = query.where(
        sql`${productsTable.price} <= ${maxPrice.toString()}`
      );
    }

    // Apply sorting
    const sortColumn = sortBy === 'price' ? productsTable.price : 
                      sortBy === 'name' ? productsTable.name : 
                      productsTable.createdAt;

    if (sortOrder === 'asc') {
      query = query.orderBy(asc(sortColumn));
    } else {
      query = query.orderBy(desc(sortColumn));
    }

    // Apply pagination
    query = query.limit(limit).offset(offset);

    const products = await query;

    // Get total count for pagination
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(productsTable);

    // Apply same filters to count query
    if (category) {
      countQuery = countQuery.where(eq(productsTable.category, category as any));
    }
    if (brand) {
      countQuery = countQuery.where(eq(productsTable.brand, brand));
    }
    if (featured !== undefined) {
      countQuery = countQuery.where(eq(productsTable.featured, featured));
    }
    if (status) {
      countQuery = countQuery.where(eq(productsTable.status, status));
    }
    if (search) {
      countQuery = countQuery.where(like(productsTable.name, `%${search}%`));
    }

    const totalResult = await countQuery;
    const total = totalResult[0]?.count || 0;

    return { 
      success: true, 
      data: products,
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
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, product_id))
      .limit(1);

    if (products.length === 0) {
      return { success: false, error: `Product with id ${product_id} not found` };
    }

    // Get product variants
    const variants = await db.select()
      .from(productVariantsTable)
      .where(eq(productVariantsTable.productId, product_id));

    // Get product reviews
    const reviews = await db.select()
      .from(productReviewsTable)
      .where(eq(productReviewsTable.productId, product_id))
      .orderBy(desc(productReviewsTable.createdAt));

    const product = {
      ...products[0],
      variants,
      reviews,
      averageRating: reviews.length > 0 ? 
        reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length : 0,
      reviewCount: reviews.length
    };

    return { success: true, data: product };
  } catch (error) {
    console.error('Get product by ID service error:', error);
    return { success: false, error: 'Failed to fetch product' };
  }
}

const getProductBySlugService = async (slug: string) => {
  try {
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.slug, slug))
      .limit(1);

    if (products.length === 0) {
      return { success: false, error: `Product with slug ${slug} not found` };
    }

    // Get product variants
    const variants = await db.select()
      .from(productVariantsTable)
      .where(eq(productVariantsTable.productId, products[0].id));

    // Get product reviews
    const reviews = await db.select()
      .from(productReviewsTable)
      .where(eq(productReviewsTable.productId, products[0].id))
      .orderBy(desc(productReviewsTable.createdAt));

    const product = {
      ...products[0],
      variants,
      reviews,
      averageRating: reviews.length > 0 ? 
        reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length : 0,
      reviewCount: reviews.length
    };

    return { success: true, data: product };
  } catch (error) {
    console.error('Get product by slug service error:', error);
    return { success: false, error: 'Failed to fetch product' };
  }
}

const createProductService = async (payload: ProductPayload) => {
  try {
    // Validate category
    if (!Object.values(productCategoryEnum.enumValues).includes(payload.category as any)) {
      return { 
        success: false, 
        error: `Invalid category. Must be one of: ${productCategoryEnum.enumValues.join(', ')}` 
      };
    }

    const product: typeof productsTable.$inferInsert = {
      name: payload.name,
      slug: payload.slug,
      description: payload.description,
      shortDescription: payload.shortDescription,
      price: payload.price.toString(),
      comparePrice: payload.comparePrice?.toString(),
      cost: payload.cost?.toString(),
      sku: payload.sku,
      barcode: payload.barcode,
      category: payload.category as any,
      brand: payload.brand,
      type: payload.type,
      quantity: payload.quantity || 0,
      lowStockThreshold: payload.lowStockThreshold || 5,
      trackQuantity: payload.trackQuantity ?? true,
      allowBackorder: payload.allowBackorder ?? false,
      weight: payload.weight?.toString(),
      length: payload.length?.toString(),
      width: payload.width?.toString(),
      height: payload.height?.toString(),
      metaTitle: payload.metaTitle,
      metaDescription: payload.metaDescription,
      tags: payload.tags,
      status: payload.status || 'active',
      featured: payload.featured || false,
      mainImage: payload.mainImage,
      images: payload.images,
      attributes: payload.attributes,
      publishedAt: payload.status === 'active' ? new Date() : undefined
    };

    const result = await db.insert(productsTable)
      .values(product)
      .returning();

    return { 
      success: true, 
      message: 'Product created successfully', 
      data: result[0] 
    };
    
  } catch (error: any) {
    console.error('Create product service error:', error);
    
    // Handle unique constraint violations
    if (error.code === '23505') {
      if (error.constraint?.includes('slug')) {
        return { success: false, error: 'Product with this slug already exists' };
      }
      if (error.constraint?.includes('sku')) {
        return { success: false, error: 'Product with this SKU already exists' };
      }
    }
    
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

    // Validate category if provided
    if (payload.category && !Object.values(productCategoryEnum.enumValues).includes(payload.category as any)) {
      return { 
        success: false, 
        error: `Invalid category. Must be one of: ${productCategoryEnum.enumValues.join(', ')}` 
      };
    }

    const updateData: Partial<typeof productsTable.$inferInsert> = {};

    // Map payload to update data
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.slug !== undefined) updateData.slug = payload.slug;
    if (payload.description !== undefined) updateData.description = payload.description;
    if (payload.shortDescription !== undefined) updateData.shortDescription = payload.shortDescription;
    if (payload.price !== undefined) updateData.price = payload.price.toString();
    if (payload.comparePrice !== undefined) updateData.comparePrice = payload.comparePrice.toString();
    if (payload.cost !== undefined) updateData.cost = payload.cost.toString();
    if (payload.sku !== undefined) updateData.sku = payload.sku;
    if (payload.barcode !== undefined) updateData.barcode = payload.barcode;
    if (payload.category !== undefined) updateData.category = payload.category as any;
    if (payload.brand !== undefined) updateData.brand = payload.brand;
    if (payload.type !== undefined) updateData.type = payload.type;
    if (payload.quantity !== undefined) updateData.quantity = payload.quantity;
    if (payload.lowStockThreshold !== undefined) updateData.lowStockThreshold = payload.lowStockThreshold;
    if (payload.trackQuantity !== undefined) updateData.trackQuantity = payload.trackQuantity;
    if (payload.allowBackorder !== undefined) updateData.allowBackorder = payload.allowBackorder;
    if (payload.weight !== undefined) updateData.weight = payload.weight.toString();
    if (payload.length !== undefined) updateData.length = payload.length.toString();
    if (payload.width !== undefined) updateData.width = payload.width.toString();
    if (payload.height !== undefined) updateData.height = payload.height.toString();
    if (payload.metaTitle !== undefined) updateData.metaTitle = payload.metaTitle;
    if (payload.metaDescription !== undefined) updateData.metaDescription = payload.metaDescription;
    if (payload.tags !== undefined) updateData.tags = payload.tags;
    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.featured !== undefined) updateData.featured = payload.featured;
    if (payload.mainImage !== undefined) updateData.mainImage = payload.mainImage;
    if (payload.images !== undefined) updateData.images = payload.images;
    if (payload.attributes !== undefined) updateData.attributes = payload.attributes;

    // Update publishedAt if status changed to active
    if (payload.status === 'active' && existingProduct[0].status !== 'active') {
      updateData.publishedAt = new Date();
    }

    updateData.updatedAt = new Date();

    const result = await db
      .update(productsTable)
      .set(updateData)
      .where(eq(productsTable.id, product_id))
      .returning();

    return { 
      success: true, 
      message: 'Product updated successfully', 
      data: result[0] 
    };
  
  } catch (error: any) {
    console.error('Update product service error:', error);
    
    // Handle unique constraint violations
    if (error.code === '23505') {
      if (error.constraint?.includes('slug')) {
        return { success: false, error: 'Product with this slug already exists' };
      }
      if (error.constraint?.includes('sku')) {
        return { success: false, error: 'Product with this SKU already exists' };
      }
    }
    
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

    await db.transaction(async (tx) => {
      // Delete product variants first
      await tx 
        .delete(productVariantsTable)
        .where(eq(productVariantsTable.productId, product_id));

      // Delete product reviews
      await tx
        .delete(productReviewsTable)
        .where(eq(productReviewsTable.productId, product_id));

      // Delete the product
      await tx 
        .delete(productsTable)
        .where(eq(productsTable.id, product_id));
    });

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
      category: req.query.category as string,
      brand: req.query.brand as string,
      featured: req.query.featured === 'true',
      status: req.query.status as string,
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

export const getProductBySlug = async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    
    if (!slug) {
      return res.status(400).json({ error: 'Invalid product slug' });
    }

    const result = await getProductBySlugService(slug);
    
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }
    
    res.json({ product: result.data });
  } catch (error) {
    console.error('Get product by slug error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export const createProduct = async (req: Request, res: Response) => {
  try {
    const payload: ProductPayload = req.body;

    // Required fields validation
    if (!payload.name || !payload.slug || !payload.category || !payload.price) {
      return res.status(400).json({ 
        error: 'Name, slug, category, and price are required' 
      });
    }

    const result = await createProductService(payload);
    
    if (!result.success) {
      const statusCode = result.error?.includes('already exists') ? 409 : 500;
      return res.status(statusCode).json({ error: result.error });
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
      const statusCode = result.error?.includes('already exists') ? 409 : 
                        result.error?.includes('not found') ? 404 : 500;
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
    const result = await getAllProductsService({
      featured: true,
      status: 'active',
      limit: 8
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

export const getProductsByCategory = async (req: Request, res: Response) => {
  try {
    const category = req.params.category;
    
    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }

    const result = await getAllProductsService({
      category,
      status: 'active'
    });
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({ 
      products: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get products by category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}