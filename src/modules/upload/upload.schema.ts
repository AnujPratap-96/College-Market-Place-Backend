import { z } from 'zod';
import { requestSchema } from '../../schemas/request.schema';

export const signUploadUrlSchema = requestSchema({
  body: z.object({
    filename: z.string().min(1, 'Filename is required'),
    fileType: z.string().regex(/^image\/(jpeg|jpg|png|webp|avif)$/i, 'File must be an image (JPEG, PNG, WebP, or AVIF)'),
    folder: z.enum(['products', 'avatars']).default('products'),
  }),
});
