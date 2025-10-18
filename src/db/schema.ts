import { integer, pgTable, varchar, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  age: integer().notNull(),
  password: varchar().notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
});


export const productsTable = pgTable("products", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  price: integer().notNull().default(0),
  description: varchar().notNull()
});

export const ordersTable = pgTable("orders", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  product_id: integer("product_id").references(() => productsTable.id),
  user_id: integer("user_id").references(() => usersTable.id),
  quantity: integer().notNull(),
  order_date: timestamp().notNull().defaultNow()
});
