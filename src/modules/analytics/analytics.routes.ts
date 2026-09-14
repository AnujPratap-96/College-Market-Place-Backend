import { Router } from 'express';
import { AnalyticsController } from './analytics.controller';
import { requireAuth } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();
const controller = new AnalyticsController();

router.get('/seller', requireAuth, asyncHandler(controller.getSellerAnalytics.bind(controller)));

export default router;
