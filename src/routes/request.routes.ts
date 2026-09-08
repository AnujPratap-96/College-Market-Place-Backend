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
} from '../controllers/request.controller';
import Auth from '../middlewares/auth';

const router = Router();

router.get('/', Auth, getAllRequests);
router.get('/sent', Auth, getMySentRequests);
router.get('/received', Auth, getMyReceivedRequests);
router.post('/', Auth, createRequest);
router.post('/:id/accept', Auth, acceptRequest);
router.post('/:id/reject', Auth, rejectRequest);
router.post('/:id/cancel', Auth, cancelRequest);
router.post('/:id/complete', Auth, completeRequest);

export default router;