import { Router } from 'express';
import {
  getAllProducts,
  getProduct,
  getFilteredProducts,
  getMyProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  markProductSold,
} from '../controllers/product.controller';
import Auth from '../middlewares/auth';

const router = Router();

router.get('/', getAllProducts);
router.get('/filters', getFilteredProducts);
router.get('/my-products', Auth, getMyProducts);
router.get('/:id', getProduct);
router.post('/', Auth, createProduct);
router.put('/:id', Auth, updateProduct);
router.patch('/:id/sold', Auth, markProductSold);
router.delete('/:id', Auth, deleteProduct);

export default router;