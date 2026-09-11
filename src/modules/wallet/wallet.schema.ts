import { z } from 'zod';
import { requestSchema } from '../../schemas/request.schema';

export const topupWalletSchema = requestSchema({
  body: z.object({
    amount: z.number().positive('Top-up amount must be greater than 0').max(50000, 'Maximum top-up limit is ₹50,000 per transaction'),
  }),
});

export const transferWalletSchema = requestSchema({
  body: z.object({
    recipient: z.string().trim().min(3, 'Recipient phone or email is required'),
    amount: z.number().positive('Transfer amount must be greater than 0'),
    note: z.string().trim().max(100, 'Note cannot exceed 100 characters').optional(),
  }),
});

export const walletHistorySchema = requestSchema({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    type: z.enum(['CREDIT', 'DEBIT', 'HOLD', 'RELEASE', 'REFUND']).optional(),
  }),
});

export const withdrawWalletSchema = requestSchema({
  body: z.object({
    upiId: z.string().trim().regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/, 'Invalid UPI ID format (e.g. username@upi)'),
    amount: z.number().positive('Withdrawal amount must be greater than 0'),
  }),
});

export const createPaymentOrderSchema = requestSchema({
  body: z.object({
    amount: z.number().positive('Amount must be greater than 0'),
  }),
});

export const verifyPaymentSchema = requestSchema({
  body: z.object({
    razorpayOrderId: z.string().min(1, 'Order ID is required'),
    razorpayPaymentId: z.string().min(1, 'Payment ID is required'),
    razorpaySignature: z.string().optional(),
    amount: z.number().positive('Amount must be greater than 0'),
  }),
});
