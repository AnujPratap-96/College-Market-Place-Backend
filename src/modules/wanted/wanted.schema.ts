import { z } from 'zod';
import { requestSchema } from '../../schemas/request.schema';

export const createWantedSchema = requestSchema({
  body: z.object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120, 'Title cannot exceed 120 characters'),
    description: z.string().trim().min(10, 'Description must be at least 10 characters').max(1000, 'Description cannot exceed 1000 characters'),
    category: z.string().trim().min(2, 'Category is required'),
    budget: z.number().positive('Budget must be greater than 0'),
    neededBy: z.string().refine(val => !isNaN(Date.parse(val)), 'Valid needed-by date is required'),
  }),
});

export const createOfferSchema = requestSchema({
  body: z.object({
    amount: z.number().positive('Offer amount must be greater than 0'),
    pickupLocation: z.string().trim().min(2, 'Pickup location is required').max(120, 'Location cannot exceed 120 characters'),
    message: z.string().trim().max(500, 'Message cannot exceed 500 characters').optional(),
  }),
  params: z.object({
    id: z.string().min(1, 'Request ID is required'),
  }),
});

export const wantedQuerySchema = requestSchema({
  query: z.object({
    category: z.string().optional(),
    search: z.string().optional(),
    status: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const wantedIdParamSchema = requestSchema({
  params: z.object({
    id: z.string().min(1, 'ID is required'),
  }),
});

export const acceptOfferParamSchema = requestSchema({
  params: z.object({
    offerId: z.string().min(1, 'Offer ID is required'),
  }),
});
