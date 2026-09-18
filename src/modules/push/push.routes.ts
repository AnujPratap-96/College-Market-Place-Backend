import { Router } from 'express';
import { subscribePush } from './push.controller';
import { requireAuth } from '../../middlewares/auth.middleware';

const router = Router();
router.post('/subscribe', requireAuth, subscribePush);

export default router;
