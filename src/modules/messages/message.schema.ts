import { z } from 'zod';
import { requestSchema } from '../../schemas/request.schema';

export const sendMessageSchema = requestSchema({
  body: z.object({
    toUserId: z.string().min(1, 'Recipient user ID is required'),
    content: z.string().trim().min(1, 'Message content cannot be empty'),
    productId: z.string().optional(),
  }),
});

export const conversationParamSchema = requestSchema({
  params: z.object({
    userId: z.string().min(1, 'User ID is required'),
  }),
  query: z.object({
    productId: z.string().optional(),
  }),
});

export const readParamSchema = requestSchema({
  params: z.object({
    fromUserId: z.string().min(1, 'Sender user ID is required'),
  }),
});
