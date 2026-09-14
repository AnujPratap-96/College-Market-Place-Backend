import { Router } from 'express';
import {
  getWallet,
  topup,
  transfer,
  getHistory,
  getStats,
  withdraw,
  getWithdrawals,
  createPaymentOrder,
  verifyPayment,
  razorpayWebhook,
} from './wallet.controller';
import { requireAuth } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  topupWalletSchema,
  transferWalletSchema,
  walletHistorySchema,
  withdrawWalletSchema,
  createPaymentOrderSchema,
  verifyPaymentSchema,
} from './wallet.schema';

const router = Router();

router.get('/', requireAuth, getWallet);
router.get('/stats', requireAuth, getStats);
router.get('/history', requireAuth, validate(walletHistorySchema), getHistory);
router.get('/ledger', requireAuth, validate(walletHistorySchema), getHistory);
router.get('/withdrawals', requireAuth, getWithdrawals);
router.post('/topup', requireAuth, validate(topupWalletSchema), topup);
router.post('/transfer', requireAuth, validate(transferWalletSchema), transfer);
router.post('/withdraw', requireAuth, validate(withdrawWalletSchema), withdraw);
router.post('/create-order', requireAuth, validate(createPaymentOrderSchema), createPaymentOrder);
router.post('/verify-payment', requireAuth, validate(verifyPaymentSchema), verifyPayment);
router.post('/webhook/razorpay', razorpayWebhook);

export default router;
