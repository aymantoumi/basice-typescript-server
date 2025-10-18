import express from 'express';
import {
  createOrder,
  getAllOrders,
  getOrderById,
  getOrdersByUserId,
  updateOrder,
  deleteOrder
} from '../controllers/ordersController.ts';

const ordersRouter = express.Router();

ordersRouter.post('/create', createOrder);
ordersRouter.get('/get-orders', getAllOrders);
ordersRouter.get('/:order_id', getOrderById);
ordersRouter.get('/user/:user_id', getOrdersByUserId);
ordersRouter.put('/:order_id', updateOrder);
ordersRouter.delete('/:order_id', deleteOrder);

export { ordersRouter };