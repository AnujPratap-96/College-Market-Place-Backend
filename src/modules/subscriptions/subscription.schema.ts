import { z } from 'zod';
import { requestSchema } from '../../schemas/request.schema';

export const subscribeSchema = requestSchema({
  body: z.object({
    productId: z.string().min(1, 'Product/Service ID is required'),
    frequency: z.enum(['WEEKLY', 'MONTHLY']).default('MONTHLY'),
    deliverySlots: z.string().trim().optional(),
    autoRenew: z.boolean().default(false),
  }),
});

export const subscriptionIdParamSchema = requestSchema({
  params: z.object({
    id: z.string().min(1, 'Subscription ID is required'),
  }),
});

export const vacationSchema = requestSchema({
  params: z.object({
    id: z.string().min(1, 'Subscription ID is required'),
  }),
  body: z.object({
    vacationFrom: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid vacation start date format (ISO expected)',
    }),
    vacationTo: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid vacation end date format (ISO expected)',
    }),
  }),
});

export const reportMissedSchema = requestSchema({
  params: z.object({
    id: z.string().min(1, 'Subscription ID is required'),
  }),
  body: z.object({
    deliveryId: z.string().min(1, 'Delivery ID is required'),
    reason: z.string().trim().min(3, 'Reason must be at least 3 characters'),
  }),
});
