import type { Request, Response } from 'express';
import {
  products
} from "../db/schema.ts";
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, desc, asc, like, sql } from 'drizzle-orm'

import { storage } from '../utilities/firebaseUtility.ts';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

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

// Helper function to delete image from Firebase Storage
const deleteImageFromStorage = async (imageUrl: string): Promise<void> => {
  try {
    if (!imageUrl || !imageUrl.includes('firebasestorage.googleapis.com')) {
      return;
    }

    // Extract the file path from the URL
    const urlParts = imageUrl.split('/o/');
    if (urlParts.length < 2) return;

    const filePathWithQuery = urlParts[1];
    const filePath = decodeURIComponent(filePathWithQuery.split('?')[0]);

    // Check if the file is in the ayman_toumi folder
    if (filePath.startsWith('ayman_toumi/')) {
      const storageRef = ref(storage, filePath);
      await deleteObject(storageRef);
    }
  } catch (error) {
    console.error('Error deleting image from storage:', error);
  }
};

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

    if (search) {
      query = query.where(like(products.name, `%${search}%`));
    }

    if (minPrice !== undefined) {
      query = query.where(sql`${products.price} >= ${minPrice.toString()}`);
    }

    if (maxPrice !== undefined) {
      query = query.where(sql`${products.price} <= ${maxPrice.toString()}`);
    }

    const sortColumn = sortBy === 'price' ? products.price :
                      sortBy === 'name' ? products.name : 
                      products.createdAt;

    if (sortOrder === 'asc') {
      query = query.orderBy(asc(sortColumn));
    } else {
      query = query.orderBy(desc(sortColumn));
    }

    query = query.limit(limit).offset(offset);

    const productsData = await query;

    let countQuery = db.select({ count: sql<number>`count(*)` }).from(products);

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

const createProductService = async (payload: ProductPayload & { imageFile?: Express.Multer.File }) => {
  try {
    let imageUrl = payload.image;

    // Handle file upload if image file is provided
    if (payload.imageFile) {
      try {
        console.log('Starting file upload...');
        
        // Upload to ayman_toumi folder
        const fileName = `ayman_toumi/${uuidv4()}_${payload.imageFile.originalname}`;
        const storageRef = ref(storage, fileName);

        console.log('Uploading to:', fileName);
        
        // Upload the file
        const snapshot = await uploadBytes(storageRef, payload.imageFile.buffer, {
          contentType: payload.imageFile.mimetype,
        });

        console.log('File uploaded successfully');

        // Get the download URL
        imageUrl = await getDownloadURL(snapshot.ref);
        console.log('Download URL:', imageUrl);
        
      } catch (firebaseError: any) {
        console.error('Firebase upload error:', firebaseError);
        return {
          success: false,
          error: `Firebase storage error: ${firebaseError.message}`
        };
      }
    }

    const product = {
      name: payload.name,
      description: payload.description,
      price: payload.price.toString(),
      quantity: payload.quantity || 0,
      image: imageUrl,
    };

    const result = await db.insert(products).values(product).returning();

    return {
      success: true,
      message: 'Product created successfully',
      data: result[0]
    };

  } catch (error: any) {
    console.error('Create product service error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create product'
    };
  }
};

const updateProductService = async (payload: ProductUpdatePayload & { imageFile?: Express.Multer.File }, product_id: number) => {
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
    let newImageUrl: string | undefined;

    // Handle new file upload if provided
    if (payload.imageFile) {
      try {
        console.log('Starting file upload for update...');
        
        const fileName = `ayman_toumi/${uuidv4()}_${payload.imageFile.originalname}`;
        const storageRef = ref(storage, fileName);

        console.log('Uploading to:', fileName);
        
        const snapshot = await uploadBytes(storageRef, payload.imageFile.buffer, {
          contentType: payload.imageFile.mimetype,
        });

        console.log('File uploaded successfully');
        newImageUrl = await getDownloadURL(snapshot.ref);
        console.log('Download URL:', newImageUrl);

        // Delete old image from storage
        const oldImageUrl = existingProduct[0].image;
        if (oldImageUrl) {
          await deleteImageFromStorage(oldImageUrl);
        }
      } catch (firebaseError: any) {
        console.error('Firebase upload error:', firebaseError);
        return {
          success: false,
          error: `Firebase storage error: ${firebaseError.message}`
        };
      }
    }

    // Map payload to update data
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.description !== undefined) updateData.description = payload.description;
    if (payload.price !== undefined) updateData.price = payload.price.toString();
    if (payload.quantity !== undefined) updateData.quantity = payload.quantity;

    if (newImageUrl) {
      updateData.image = newImageUrl;
    } else if (payload.image !== undefined) {
      updateData.image = payload.image;
    }

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

    // Delete associated image from Firebase Storage
    const imageUrl = existingProduct[0].image;
    if (imageUrl) {
      await deleteImageFromStorage(imageUrl);
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

export const createProduct = async (req: MulterRequest, res: Response) => {
  try {
    const payload: ProductPayload = req.body;
    const imageFile = req.file;

    // Parse numeric fields if they're strings
    if (typeof payload.price === 'string') {
      payload.price = parseFloat(payload.price);
    }
    if (payload.quantity && typeof payload.quantity === 'string') {
      payload.quantity = parseInt(payload.quantity);
    }

    // Required fields validation
    if (!payload.name || payload.price === undefined || isNaN(Number(payload.price))) {
      return res.status(400).json({
        error: 'Name and valid price are required'
      });
    }

    const result = await createProductService({
      ...payload,
      imageFile
    });
    
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

export const updateProduct = async (req: MulterRequest, res: Response) => {
  try {
    const product_id = parseInt(req.params.product_id);

    if (isNaN(product_id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const payload: ProductUpdatePayload = req.body;
    const imageFile = req.file;

    if (payload.price && typeof payload.price === 'string') {
      payload.price = parseFloat(payload.price);
    }
    if (payload.quantity && typeof payload.quantity === 'string') {
      payload.quantity = parseInt(payload.quantity);
    }

    const result = await updateProductService({
      ...payload,
      imageFile
    }, product_id);

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

export const getFeaturedProducts = async (req: Request, res: Response) => {
  try {
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