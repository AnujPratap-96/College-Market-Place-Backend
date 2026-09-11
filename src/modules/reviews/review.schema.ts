import { z } from 'zod';
import { requestSchema } from '../../schemas/request.schema';

export const createReviewSchema = requestSchema({
  body: z.object({
    orderId: z.string().min(1, 'Order ID is required'),
    rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
    headline: z.string().trim().max(100, 'Headline cannot exceed 100 characters').optional(),
    comment: z.string().trim().min(3, 'Comment must be at least 3 characters').max(1000, 'Comment cannot exceed 1000 characters'),
    isAnonymous: z.boolean().optional(),
  }),
});

export const userReviewsParamSchema = requestSchema({
  params: z.object({
    userId: z.string().min(1, 'User ID is required'),
  }),
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const productReviewsParamSchema = requestSchema({
  params: z.object({
    productId: z.string().min(1, 'Product ID is required'),
  }),
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});
