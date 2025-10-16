import { productsTable } from "../db/schema.ts";
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm'

import dotenv from "dotenv";

const db = drizzle(process.env.DATABASE_URL)

type productUpdatePayload = Partial <{
  name,
  price,
  discreption
}>;

export const getAllProducts = async () => {
  try {
    const products = await db.select().from(productsTable)

    return products;
  } catch (error) {
    console.error(error);
    
  }
}

export const createProduct = async ( name: String, price: Number, discreption: String ) => {
  try {
    const product: typeof productsTable.$inferInsert = {
      name: name,
      price: price,
      discreption: discreption
    };

    await db.insert(productsTable).values(product);

    return product
    
  } catch (error) {
    console.error(error);
  }
}


export const updateProduct = async (payload:Product, product_id: Number) => {
  
  const p_id = parseInt(product_id)

  const existingProduct = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, p_id))
      .limit(1);

  if (!existingProduct || existingProduct.length === 0) {
      return { success: false, message: `No product found with id => ${p_id}` };
    }

  try {
    
    const result = await db
      .update(productsTable)
      .set(payload) 
      .where(eq(productsTable.id, p_id))
      .returning(); 
  
    return result;
  
  } catch (error) {
    console.error(error);
  }
}

export const productDelete = async (product_id:Number) => {

  const p_id = parseInt(product_id)

  try {
    const my_product = await db 
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, p_id))
    .limit(1);

    console.log(my_product);
    

    if (!my_product || my_product.length == 0) {
      return false
    }

    await db 
       .delete(productsTable)
       .where(eq(productsTable.id, p_id))

    return `product ${p_id} deletted`

  } catch (error) {
    console.error(error);
        
  }
}
