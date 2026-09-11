import { z } from 'zod';
import { requestSchema } from '../../schemas/request.schema';

export const createRequestSchema = requestSchema({
  body: z.object({
    productId: z.string().min(1, 'Product ID is required'),
    message: z.string().optional(),
    totalAmount: z.number().positive('Total amount must be positive'),
    platformFee: z.number().optional(),
  }),
});

export const requestIdParamSchema = requestSchema({
  params: z.object({
    id: z.string().min(1, 'Request ID is required'),
  }),
});

export const completeRequestSchema = requestSchema({
  params: z.object({
    id: z.string().min(1, 'Request ID is required'),
  }),
  body: z.object({
    paymentMethod: z.enum(['CASH', 'ONLINE']).default('CASH'),
  }),
});
