import { Router } from 'express';
import {
  getMyMessages,
  sendMessage,
  getConversation,
  getConversationsList,
  markAsRead,
} from './message.controller';
import { requireAuth } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  sendMessageSchema,
  conversationParamSchema,
  readParamSchema,
} from './message.schema';

const router = Router();

router.get('/', requireAuth, getMyMessages);
router.get('/conversations', requireAuth, getConversationsList);
router.get('/conversation/:userId', requireAuth, validate(conversationParamSchema), getConversation);
router.post('/', requireAuth, validate(sendMessageSchema), sendMessage);
router.post('/read/:fromUserId', requireAuth, validate(readParamSchema), markAsRead);

export default router;
