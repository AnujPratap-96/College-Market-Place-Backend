import { Router } from 'express';
import {
  subscribe,
  getMySubscriptions,
  getProviderManifest,
  setVacation,
  resumeVacation,
  reportMissedDelivery,
  cancelSubscription,
  settleEndedCycles,
} from './subscription.controller';
import { requireAuth, requireAdmin } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  subscribeSchema,
  subscriptionIdParamSchema,
  vacationSchema,
  reportMissedSchema,
} from './subscription.schema';

const router = Router();

router.post('/subscribe', requireAuth, validate(subscribeSchema), subscribe);
router.get('/my', requireAuth, getMySubscriptions);
router.get('/my-subscriptions', requireAuth, getMySubscriptions);
router.get('/provider/manifest', requireAuth, getProviderManifest);
router.post('/:id/vacation', requireAuth, validate(vacationSchema), setVacation);
router.post('/:id/resume', requireAuth, validate(subscriptionIdParamSchema), resumeVacation);
router.post('/:id/report-missed', requireAuth, validate(reportMissedSchema), reportMissedDelivery);
router.post('/:id/cancel', requireAuth, validate(subscriptionIdParamSchema), cancelSubscription);
router.post('/cron/settle', requireAuth, requireAdmin, settleEndedCycles);

export default router;
