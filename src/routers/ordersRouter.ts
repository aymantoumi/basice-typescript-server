import { Router } from 'express';
import {
  createOrder,
  getAllOrders,
  getOrderById,
  getOrdersByUserId,
  updateOrder,
  addProductToOrder,
  removeProductFromOrder,
  deleteOrder
} from '../controllers/ordersController.ts';

import { authenticateToken } from '../middleware/authMiddleware.ts';

const ordersRouter = Router();

ordersRouter.post('/', authenticateToken, createOrder);
ordersRouter.get('/', authenticateToken, getAllOrders);
ordersRouter.get('/:order_id', authenticateToken, getOrderById);
ordersRouter.get('/user/:user_id', authenticateToken, getOrdersByUserId);
ordersRouter.put('/:order_id', authenticateToken, updateOrder);
ordersRouter.post('/:order_id/items', authenticateToken, addProductToOrder);
ordersRouter.delete('/:order_id/items/:order_item_id', authenticateToken, removeProductFromOrder);
ordersRouter.delete('/:order_id', authenticateToken, deleteOrder);

export default ordersRouter;