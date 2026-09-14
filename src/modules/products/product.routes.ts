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
  reportProduct,
  estimateProductListing,
} from './product.controller';
import { requireAuth } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createProductSchema,
  updateProductSchema,
  productIdParamSchema,
  filterProductsSchema,
  reportProductSchema,
} from './product.schema';

const router = Router();

router.get('/', getAllProducts);
router.get('/filters', validate(filterProductsSchema), getFilteredProducts);
router.get('/my-products', requireAuth, getMyProducts);
router.post('/ai-estimate-listing', requireAuth, estimateProductListing);
router.get('/:id', validate(productIdParamSchema), getProduct);

router.post('/', requireAuth, validate(createProductSchema), createProduct);
router.post('/:id/report', requireAuth, validate(reportProductSchema), reportProduct);
router.put('/:id', requireAuth, validate(updateProductSchema), updateProduct);
router.patch('/:id/sold', requireAuth, validate(productIdParamSchema), markProductSold);
router.delete('/:id', requireAuth, validate(productIdParamSchema), deleteProduct);

export default router;
