import { Router } from 'express';
import {
  checkout,
  verifyHandover,
  verifyReturn,
  confirmReceived,
  cancelOrder,
  getMyOrders,
  getMySales,
  getOrderById,
  raiseDispute,
  bookService,
  completeService,
  confirmService,
} from './order.controller';
import { requireAuth } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  checkoutOrderSchema,
  orderIdParamSchema,
  verifyDeliverySchema,
  verifyReturnSchema,
  disputeOrderSchema,
  bookServiceSchema,
} from './order.schema';

const router = Router();

router.post('/checkout', requireAuth, validate(checkoutOrderSchema), checkout);
router.post('/service-book', requireAuth, validate(bookServiceSchema), bookService);
router.post('/:id/service-complete', requireAuth, validate(orderIdParamSchema), completeService);
router.post('/:id/service-confirm', requireAuth, validate(orderIdParamSchema), confirmService);
router.post('/:id/verify-handover', requireAuth, validate(verifyDeliverySchema), verifyHandover);
router.post('/:id/verify-return', requireAuth, validate(verifyReturnSchema), verifyReturn);
router.post('/:id/confirm-receipt', requireAuth, validate(orderIdParamSchema), confirmReceived);
router.post('/:id/cancel', requireAuth, validate(orderIdParamSchema), cancelOrder);
router.post('/:id/dispute', requireAuth, validate(disputeOrderSchema), raiseDispute);
router.get('/my-orders', requireAuth, getMyOrders);
router.get('/my-sales', requireAuth, getMySales);
router.get('/:id', requireAuth, validate(orderIdParamSchema), getOrderById);

export default router;
