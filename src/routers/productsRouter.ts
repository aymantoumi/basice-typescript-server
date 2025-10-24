import express from 'express';
import { 
  createProduct, 
  deleteProduct, 
  getAllProducts, 
  getProductById, 
  getProductBySlug,
  updateProduct,
  getFeaturedProducts,
  getProductsByCategory 
} from '../controllers/productsController.ts'

const productsRouter = express.Router();

productsRouter.post('/', createProduct);
productsRouter.get('/', getAllProducts);
productsRouter.get('/featured', getFeaturedProducts);
productsRouter.get('/category/:category', getProductsByCategory);
productsRouter.get('/slug/:slug', getProductBySlug);
productsRouter.get('/:product_id', getProductById);
productsRouter.put('/:product_id', updateProduct);
productsRouter.delete('/:product_id', deleteProduct);

export { productsRouter };