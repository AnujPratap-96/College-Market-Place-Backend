import { z } from 'zod';
import { requestSchema } from '../../schemas/request.schema';

export const updateProfileSchema = requestSchema({
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').optional(),
    phone: z.string().trim().min(10, 'Valid phone number is required').optional(),
    phoneNo: z.string().trim().min(10, 'Valid phone number is required').optional(),
    college: z.string().trim().optional(),
    branch: z.string().trim().optional(),
    year: z.string().trim().optional(),
    profileImage: z.string().url('Invalid profile image URL').optional().or(z.literal('')),
    image: z.string().url('Invalid image URL').optional().or(z.literal('')),
  }),
});
