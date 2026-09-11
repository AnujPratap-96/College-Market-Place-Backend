import { Router } from 'express';
import {
  getAllRequests,
  getMySentRequests,
  getMyReceivedRequests,
  createRequest,
  acceptRequest,
  rejectRequest,
  cancelRequest,
  completeRequest,
} from './request.controller';
import { requireAuth } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createRequestSchema,
  requestIdParamSchema,
  completeRequestSchema,
} from './request.schema';

const router = Router();

router.get('/', requireAuth, getAllRequests);
router.get('/sent', requireAuth, getMySentRequests);
router.get('/received', requireAuth, getMyReceivedRequests);

router.post('/', requireAuth, validate(createRequestSchema), createRequest);
router.post('/:id/accept', requireAuth, validate(requestIdParamSchema), acceptRequest);
router.post('/:id/reject', requireAuth, validate(requestIdParamSchema), rejectRequest);
router.post('/:id/cancel', requireAuth, validate(requestIdParamSchema), cancelRequest);
router.post('/:id/complete', requireAuth, validate(completeRequestSchema), completeRequest);

export default router;
