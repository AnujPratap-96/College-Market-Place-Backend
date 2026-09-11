import { Router } from 'express';
import {
  createRequest,
  getRequests,
  getRequestById,
  submitOffer,
  acceptOffer,
  cancelRequest,
  getMyRequests,
  getMyOffers,
} from './wanted.controller';
import { requireAuth, optionalAuth } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createWantedSchema,
  createOfferSchema,
  wantedQuerySchema,
  wantedIdParamSchema,
  acceptOfferParamSchema,
} from './wanted.schema';

const router = Router();

router.get('/', validate(wantedQuerySchema), getRequests);
router.get('/my-requests', requireAuth, getMyRequests);
router.get('/my-offers', requireAuth, getMyOffers);
router.get('/:id', optionalAuth, validate(wantedIdParamSchema), getRequestById);
router.post('/', requireAuth, validate(createWantedSchema), createRequest);
router.post('/:id/offers', requireAuth, validate(createOfferSchema), submitOffer);
router.post('/offers/:offerId/accept', requireAuth, validate(acceptOfferParamSchema), acceptOffer);
router.delete('/:id', requireAuth, validate(wantedIdParamSchema), cancelRequest);

export default router;
