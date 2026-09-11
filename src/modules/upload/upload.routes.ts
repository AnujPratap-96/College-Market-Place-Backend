import { Router } from 'express';
import multer from 'multer';
import { requestSignedUrl, directUpload } from './upload.controller';
import { requireAuth } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { signUploadUrlSchema } from './upload.schema';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post('/sign-url', requireAuth, validate(signUploadUrlSchema), requestSignedUrl);
router.post('/direct', requireAuth, upload.single('file'), directUpload);

export default router;
