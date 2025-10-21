ALTER TABLE "orders" ADD COLUMN "user_address" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "quantity";