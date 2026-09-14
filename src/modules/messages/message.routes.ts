import { Router } from 'express';
import multer from 'multer';
import {
  getMyMessages,
  sendMessage,
  getConversation,
  getConversationsList,
  markAsRead,
  getUnreadCount,
  uploadChatMedia,
} from './message.controller';
import { requireAuth } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  sendMessageSchema,
  conversationParamSchema,
  readParamSchema,
} from './message.schema';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.get('/', requireAuth, getMyMessages);
router.get('/unread-count', requireAuth, getUnreadCount);
router.get('/conversations', requireAuth, getConversationsList);
router.get('/conversation/:userId', requireAuth, validate(conversationParamSchema), getConversation);
router.post('/', requireAuth, validate(sendMessageSchema), sendMessage);
router.post('/read/:fromUserId', requireAuth, validate(readParamSchema), markAsRead);
router.post('/media-upload', requireAuth, upload.single('file'), uploadChatMedia);

export default router;
