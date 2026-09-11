import { z } from 'zod';
import { requestSchema } from '../../schemas/request.schema';

export const createAuctionBodySchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  category: z.string().min(1, 'Category is required'),
  imageUrl: z.string().optional(),
  startingBid: z.number().positive('Starting bid must be positive'),
  minIncrement: z.number().positive().default(50).optional(),
  reservePrice: z.number().positive().optional(),
  durationHours: z.number().min(0.01).max(168).default(24),
  antiSnipingSeconds: z.number().min(10).max(300).default(60).optional(),
});

export const createAuctionSchema = requestSchema({
  body: createAuctionBodySchema,
});

export const auctionIdParamSchema = requestSchema({
  params: z.object({
    id: z.string().min(1, 'Auction ID is required'),
  }),
});

export const placeBidBodySchema = z.object({
  amount: z.number().positive('Bid amount must be positive'),
});

export const placeBidSchema = requestSchema({
  params: z.object({
    id: z.string().min(1, 'Auction ID is required'),
  }),
  body: placeBidBodySchema,
});

export type CreateAuctionInput = z.infer<typeof createAuctionBodySchema>;
export type PlaceBidInput = z.infer<typeof placeBidBodySchema>;
