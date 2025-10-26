import express from 'express';
import { 
  createProduct, 
  deleteProduct, 
  getAllProducts, 
  getProductById, 
  updateProduct,
  getFeaturedProducts
} from '../controllers/productsController.ts';

const productsRouter = express.Router();

productsRouter.post('/', createProduct);
productsRouter.get('/', getAllProducts);
productsRouter.get('/featured', getFeaturedProducts);
productsRouter.get('/:product_id', getProductById);
productsRouter.put('/:product_id', updateProduct);
productsRouter.delete('/:product_id', deleteProduct);

export { productsRouter };