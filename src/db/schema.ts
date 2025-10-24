import { integer, pgTable, varchar, timestamp, serial, text, boolean, decimal, json, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }),
  age: integer('age'),
  googleId: varchar('google_id', { length: 255 }), 
  avatar: text('avatar'), 
  emailVerified: boolean('email_verified').default(false), 
  authProvider: varchar('auth_provider', { length: 50 }).default('local'), 
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Product Categories
export const productCategoryEnum = pgEnum('product_category', [
  'electronics',
  'clothing',
  'home_kitchen',
  'books',
  'sports',
  'beauty',
  'toys',
  'automotive',
  'health',
  'jewelry'
]);

export const productsTable = pgTable("products", {
  id: serial('id').primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  slug: varchar({ length: 300 }).notNull().unique(),
  description: text('description'),
  shortDescription: varchar({ length: 500 }),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  comparePrice: decimal('compare_price', { precision: 10, scale: 2 }),
  cost: decimal('cost', { precision: 10, scale: 2 }),
  sku: varchar('sku', { length: 100 }).unique(),
  barcode: varchar('barcode', { length: 100 }),
  category: productCategoryEnum('category').notNull(),
  brand: varchar('brand', { length: 100 }),
  type: varchar('type', { length: 50 }), 
  
  // Inventory
  quantity: integer('quantity').default(0),
  lowStockThreshold: integer('low_stock_threshold').default(5),
  trackQuantity: boolean('track_quantity').default(true),
  allowBackorder: boolean('allow_backorder').default(false),
  
  // Shipping
  weight: decimal('weight', { precision: 8, scale: 3 }),
  length: decimal('length', { precision: 8, scale: 2 }),
  width: decimal('width', { precision: 8, scale: 2 }),
  height: decimal('height', { precision: 8, scale: 2 }),
  
  // SEO & Visibility
  metaTitle: varchar('meta_title', { length: 255 }),
  metaDescription: text('meta_description'),
  tags: json('tags').$type<string[]>(),
  
  // Status
  status: varchar('status', { length: 20 }).default('active'),
  featured: boolean('featured').default(false),
  
  // Images
  mainImage: text('main_image'), 
  images: json('images').$type<string[]>(), 
  
  // Specifications/Attributes
  attributes: json('attributes').$type<Record<string, any>>(),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  publishedAt: timestamp('published_at'),
});

// Product Variants
export const productVariantsTable = pgTable("product_variants", {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => productsTable.id).notNull(),
  sku: varchar('sku', { length: 100 }).unique(),
  price: decimal('price', { precision: 10, scale: 2 }),
  comparePrice: decimal('compare_price', { precision: 10, scale: 2 }),
  cost: decimal('cost', { precision: 10, scale: 2 }),
  quantity: integer('quantity').default(0),
  weight: decimal('weight', { precision: 8, scale: 3 }),
  
  // Variant options
  options: json('options').$type<Record<string, string>>(),
  
  image: text('image'),
  barcode: varchar('barcode', { length: 100 }),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Product Reviews
export const productReviewsTable = pgTable("product_reviews", {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => productsTable.id).notNull(),
  userId: integer('user_id').references(() => usersTable.id).notNull(),
  rating: integer('rating').notNull(),
  title: varchar('title', { length: 255 }),
  comment: text('comment'),
  verifiedPurchase: boolean('verified_purchase').default(false),
  
  // Moderation
  status: varchar('status', { length: 20 }).default('pending'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Shopping Cart
export const cartTable = pgTable("cart", {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => usersTable.id),
  sessionId: varchar('session_id', { length: 255 }), 
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const cartItemsTable = pgTable("cart_items", {
  id: serial('id').primaryKey(),
  cartId: integer('cart_id').references(() => cartTable.id).notNull(),
  productId: integer('product_id').references(() => productsTable.id),
  variantId: integer('variant_id').references(() => productVariantsTable.id),
  quantity: integer('quantity').notNull().default(1),
  
  // Store price at time of adding to cart
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Orders
export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded'
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'paid',
  'failed',
  'refunded',
  'cancelled'
]);

export const ordersTable = pgTable("orders", {
  id: serial('id').primaryKey(),
  orderNumber: varchar('order_number', { length: 50 }).unique().notNull(),
  userId: integer('user_id').references(() => usersTable.id),
  
  // Order totals
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }).default('0.00'),
  shippingAmount: decimal('shipping_amount', { precision: 10, scale: 2 }).default('0.00'),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).default('0.00'),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  
  // Status
  status: orderStatusEnum('status').default('pending'),
  paymentStatus: paymentStatusEnum('payment_status').default('pending'),
  
  // Customer information
  customerEmail: varchar('customer_email', { length: 255 }).notNull(),
  customerPhone: varchar('customer_phone', { length: 50 }),
  
  // Shipping address
  shippingAddress: json('shipping_address').$type<{
    firstName: string;
    lastName: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  }>(),
  
  // Billing address
  billingAddress: json('billing_address').$type<{
    firstName: string;
    lastName: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  }>(),
  
  // Payment information
  paymentMethod: varchar('payment_method', { length: 50 }),
  transactionId: varchar('transaction_id', { length: 255 }),
  
  // Shipping information
  shippingMethod: varchar('shipping_method', { length: 100 }),
  trackingNumber: varchar('tracking_number', { length: 255 }),
  
  // Timestamps
  orderDate: timestamp('order_date').defaultNow(),
  paidAt: timestamp('paid_at'),
  shippedAt: timestamp('shipped_at'),
  deliveredAt: timestamp('delivered_at'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const orderItemsTable = pgTable("order_items", {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => ordersTable.id).notNull(),
  productId: integer('product_id').references(() => productsTable.id),
  variantId: integer('variant_id').references(() => productVariantsTable.id),
  
  // Product details at time of order
  productName: varchar('product_name', { length: 255 }).notNull(),
  productSku: varchar('product_sku', { length: 100 }),
  variantOptions: json('variant_options').$type<Record<string, string>>(),
  
  quantity: integer('quantity').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  comparePrice: decimal('compare_price', { precision: 10, scale: 2 }),
  
  createdAt: timestamp('created_at').defaultNow(),
});

// Wishlist
export const wishlistTable = pgTable("wishlist", {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => usersTable.id).notNull(),
  productId: integer('product_id').references(() => productsTable.id).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Categories (if you want a separate categories table)
export const categoriesTable = pgTable("categories", {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 300 }).notNull().unique(),
  description: text('description'),
  parentId: integer('parent_id').references((): any => categoriesTable.id),
  image: text('image'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Product-Category many-to-many relationship
export const productCategoriesTable = pgTable("product_categories", {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => productsTable.id).notNull(),
  categoryId: integer('category_id').references(() => categoriesTable.id).notNull(),
});

// Enhanced Relations
export const productsRelations = relations(productsTable, ({ many }) => ({
  variants: many(productVariantsTable),
  reviews: many(productReviewsTable),
  cartItems: many(cartItemsTable),
  orderItems: many(orderItemsTable),
  wishlistItems: many(wishlistTable),
  productCategories: many(productCategoriesTable),
}));

export const productVariantsRelations = relations(productVariantsTable, ({ one }) => ({
  product: one(productsTable, {
    fields: [productVariantsTable.productId],
    references: [productsTable.id],
  }),
}));

export const ordersRelations = relations(ordersTable, ({ many, one }) => ({
  user: one(usersTable, {
    fields: [ordersTable.userId],
    references: [usersTable.id],
  }),
  orderItems: many(orderItemsTable),
}));

export const orderItemsRelations = relations(orderItemsTable, ({ one }) => ({
  order: one(ordersTable, {
    fields: [orderItemsTable.orderId],
    references: [ordersTable.id],
  }),
  product: one(productsTable, {
    fields: [orderItemsTable.productId],
    references: [productsTable.id],
  }),
  variant: one(productVariantsTable, {
    fields: [orderItemsTable.variantId],
    references: [productVariantsTable.id],
  }),
}));

export const cartRelations = relations(cartTable, ({ many, one }) => ({
  user: one(usersTable, {
    fields: [cartTable.userId],
    references: [usersTable.id],
  }),
  cartItems: many(cartItemsTable),
}));

export const cartItemsRelations = relations(cartItemsTable, ({ one }) => ({
  cart: one(cartTable, {
    fields: [cartItemsTable.cartId],
    references: [cartTable.id],
  }),
  product: one(productsTable, {
    fields: [cartItemsTable.productId],
    references: [productsTable.id],
  }),
  variant: one(productVariantsTable, {
    fields: [cartItemsTable.variantId],
    references: [productVariantsTable.id],
  }),
}));

export const productReviewsRelations = relations(productReviewsTable, ({ one }) => ({
  product: one(productsTable, {
    fields: [productReviewsTable.productId],
    references: [productsTable.id],
  }),
  user: one(usersTable, {
    fields: [productReviewsTable.userId],
    references: [usersTable.id],
  }),
}));

export const wishlistRelations = relations(wishlistTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [wishlistTable.userId],
    references: [usersTable.id],
  }),
  product: one(productsTable, {
    fields: [wishlistTable.productId],
    references: [productsTable.id],
  }),
}));

export const categoriesRelations = relations(categoriesTable, ({ many }) => ({
  productCategories: many(productCategoriesTable),
}));

export const productCategoriesRelations = relations(productCategoriesTable, ({ one }) => ({
  product: one(productsTable, {
    fields: [productCategoriesTable.productId],
    references: [productsTable.id],
  }),
  category: one(categoriesTable, {
    fields: [productCategoriesTable.categoryId],
    references: [categoriesTable.id],
  }),
}));