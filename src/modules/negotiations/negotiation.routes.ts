import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import {
  createOffer,
  counterOffer,
  acceptOffer,
  declineOffer,
  getActiveOffer,
} from './negotiation.controller';

const router = Router();

router.use(requireAuth);

router.post('/offer', createOffer);
router.post('/:id/counter', counterOffer);
router.post('/:id/accept', acceptOffer);
router.post('/:id/decline', declineOffer);
router.get('/product/:productId', getActiveOffer);

export default router;
