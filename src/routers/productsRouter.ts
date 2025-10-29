// routes/products.ts
import express from 'express';
import { 
  getAllProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  getFeaturedProducts 
} from '../controllers/productsController.ts';
import { uploadSingle } from '../middleware/upload.ts';

const productsRouter = express.Router();

productsRouter.get('/', getAllProducts);
productsRouter.get('/featured', getFeaturedProducts);
productsRouter.get('/:product_id', getProductById);
productsRouter.post('/', uploadSingle, createProduct);
productsRouter.put('/:product_id', uploadSingle, updateProduct);
productsRouter.delete('/:product_id', deleteProduct);

export { productsRouter };