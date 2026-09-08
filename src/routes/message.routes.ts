import { Router } from 'express';
import {
  getMyMessages,
  sendMessage,
  getConversation,
  getConversationsList,
  markAsRead,
} from '../controllers/message.controller';
import Auth from '../middlewares/auth';

const router = Router();

router.get('/', Auth, getMyMessages);
router.get('/conversations', Auth, getConversationsList);
router.get('/conversation/:userId', Auth, getConversation);
router.post('/', Auth, sendMessage);
router.post('/read/:fromUserId', Auth, markAsRead);

export default router;