import express from 'express';
import { createProduct, deleteProduct, getAllProducts, getProductById, updateProduct } from '../controllers/productsController.ts'
const productsRouter = express.Router();

productsRouter.post('/create', createProduct);

productsRouter.get('/get-products', getAllProducts);

productsRouter.get('/:product_id', getProductById);

productsRouter.put('/:product_id', updateProduct);

productsRouter.delete('/:product_id', deleteProduct);

export { productsRouter };

