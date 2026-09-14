import { z } from 'zod';
import { requestSchema } from '../../schemas/request.schema';

export const createProductSchema = requestSchema({
  body: z.object({
    title: z.string().trim().min(2, 'Title must be at least 2 characters'),
    description: z.string().trim().min(5, 'Description must be at least 5 characters'),
    price: z.number().positive('Price must be greater than zero'),
    type: z.enum(['SELL', 'RENT', 'SERVICE', 'SUBSCRIPTION']),
    category: z.string().trim().min(1, 'Category is required'),
    imageUrl: z.string().url('Invalid image URL').optional().or(z.literal('')),
    images: z.array(z.string()).optional(),
    securityDeposit: z.number().nonnegative().optional(),
    rentalDuration: z.string().trim().optional(),
    frequency: z.enum(['WEEKLY', 'MONTHLY']).optional(),
    deliverySlots: z.string().trim().optional(),
    serviceDuration: z.string().trim().optional(),
  }),
});

export const updateProductSchema = requestSchema({
  params: z.object({
    id: z.string().min(1, 'Product ID is required'),
  }),
  body: z.object({
    title: z.string().trim().min(2).optional(),
    description: z.string().trim().min(5).optional(),
    price: z.number().positive().optional(),
    type: z.enum(['SELL', 'RENT', 'SERVICE', 'SUBSCRIPTION']).optional(),
    category: z.string().trim().optional(),
    imageUrl: z.string().url().optional().or(z.literal('')),
    images: z.array(z.string()).optional(),
    securityDeposit: z.number().nonnegative().optional(),
    rentalDuration: z.string().trim().optional(),
    status: z.enum(['AVAILABLE', 'PENDING', 'SOLD']).optional(),
    frequency: z.enum(['WEEKLY', 'MONTHLY']).optional(),
    deliverySlots: z.string().trim().optional(),
    serviceDuration: z.string().trim().optional(),
  }),
});

export const productIdParamSchema = requestSchema({
  params: z.object({
    id: z.string().min(1, 'Product ID is required'),
  }),
});

export const filterProductsSchema = requestSchema({
  query: z.object({
    q: z.string().optional(),
    category: z.string().optional(),
    type: z.string().optional(),
  }),
});

export const reportProductSchema = requestSchema({
  params: z.object({
    id: z.string().min(1, 'Product ID is required'),
  }),
  body: z.object({
    reason: z.string().trim().min(3, 'Reason must be at least 3 characters'),
    details: z.string().trim().optional(),
  }),
});
