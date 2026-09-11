import { z } from 'zod';
import { requestSchema } from '../../schemas/request.schema';

export const checkoutOrderSchema = requestSchema({
  body: z.object({
    productId: z.string().min(1, 'Product ID is required'),
    paymentMethod: z.enum(['WALLET', 'ONLINE', 'CASH']).default('WALLET'),
    rentalDays: z.number().int().positive('Rental days must be at least 1 day').optional(),
    securityDeposit: z.number().nonnegative('Security deposit cannot be negative').optional(),
  }),
});

export const orderIdParamSchema = requestSchema({
  params: z.object({
    id: z.string().min(1, 'Order ID is required'),
  }),
});

export const verifyDeliverySchema = requestSchema({
  params: z.object({
    id: z.string().min(1, 'Order ID is required'),
  }),
  body: z.object({
    pickupOtp: z.string().trim().length(6, 'Pickup verification OTP must be exactly 6 digits'),
  }),
});

export const verifyReturnSchema = requestSchema({
  params: z.object({
    id: z.string().min(1, 'Order ID is required'),
  }),
  body: z.object({
    returnOtp: z.string().trim().length(6, 'Return verification OTP must be exactly 6 digits'),
  }),
});

export const disputeOrderSchema = requestSchema({
  params: z.object({
    id: z.string().min(1, 'Order ID is required'),
  }),
  body: z.object({
    reason: z.string().trim().min(5, 'Dispute reason must be at least 5 characters'),
  }),
});

export const bookServiceSchema = requestSchema({
  body: z.object({
    productId: z.string().min(1, 'Product ID is required'),
    preferredTime: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  }),
});
