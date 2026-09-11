import { Router } from 'express';
import {
  submitReview,
  getUserReviews,
  getProductReviews,
  getPendingReviews,
} from './review.controller';
import { requireAuth } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createReviewSchema,
  userReviewsParamSchema,
  productReviewsParamSchema,
} from './review.schema';

const router = Router();

router.post('/', requireAuth, validate(createReviewSchema), submitReview);
router.get('/pending', requireAuth, getPendingReviews);
router.get('/user/:userId', validate(userReviewsParamSchema), getUserReviews);
router.get('/product/:productId', validate(productReviewsParamSchema), getProductReviews);

export default router;
