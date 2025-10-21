import { integer, pgTable, varchar, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

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
  user_id: integer("user_id").references(() => usersTable.id),
  user_address: varchar().notNull(),
  order_date: timestamp().notNull().defaultNow()
});

export const orderProductsTable = pgTable("order_products", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  product_id: integer("product_id").references(() => productsTable.id),
  order_id: integer("order_id").references(() => ordersTable.id),
  quantity: integer().notNull().default(1),
  created_at: timestamp().defaultNow()
});

// Relations
export const ordersRelations = relations(ordersTable, ({ many, one }) => ({
  user: one(usersTable, {
    fields: [ordersTable.user_id],
    references: [usersTable.id],
  }),
  orderProducts: many(orderProductsTable),
}));

export const orderProductsRelations = relations(orderProductsTable, ({ one }) => ({
  order: one(ordersTable, {
    fields: [orderProductsTable.order_id],
    references: [ordersTable.id],
  }),
  product: one(productsTable, {
    fields: [orderProductsTable.product_id],
    references: [productsTable.id],
  }),
}));