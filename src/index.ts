import express from 'express';
import type { Request, Response, Application } from 'express';
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { userRouter } from "./routers/userRouter.ts";
import { productsRouter } from "./routers/productsRouter.ts";
import { authRouter } from "./routers/authRouter.ts";
import { ordersRouter } from "./routers/ordersRouter.ts";
import dotenv from "dotenv";

dotenv.config();

const db = drizzle(process.env.DATABASE_URL!);
const port = process.env.PORT || 3000;

const app: Application = express();
app.use(express.json());

// Routes
app.use('/auth', authRouter);
app.use('/users', userRouter);
app.use('/products', productsRouter);
app.use('/orders', ordersRouter);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});