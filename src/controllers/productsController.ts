import { productsTable } from "../db/schema.ts";
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm'

import dotenv from "dotenv";

const db = drizzle(process.env.DATABASE_URL)

export const getAllProducts = async () => {
  try {
    const products = await db.select().from(productsTable)

    return products;
  } catch (error) {
    console.error(error);
    
  }
}

export const createProduct = async ( name, price, discreption ) => {
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

