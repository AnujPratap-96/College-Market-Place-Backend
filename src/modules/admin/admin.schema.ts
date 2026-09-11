import { z } from 'zod';
import { requestSchema } from '../../schemas/request.schema';

export const adminPaginationSchema = requestSchema({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
  }),
});

export const adminIdParamSchema = requestSchema({
  params: z.object({
    id: z.string().min(1, 'ID is required'),
  }),
});

export const createAdminSchema = requestSchema({
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters'),
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    phone: z.string().trim().min(10, 'Valid phone number is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    college: z.string().trim().min(2, 'College is required'),
    branch: z.string().trim().min(2, 'Branch is required'),
    year: z.string().trim().min(1, 'Year is required'),
  }),
});

export const adminReportActionSchema = requestSchema({
  params: z.object({
    id: z.string().min(1, 'Report ID is required'),
  }),
  body: z.object({
    action: z.enum(['DISMISS', 'FLAG_PRODUCT', 'UNFLAG_PRODUCT', 'DELETE_PRODUCT']),
    notes: z.string().optional(),
  }),
});

export const adminDisputeActionSchema = requestSchema({
  params: z.object({
    id: z.string().min(1, 'Order ID is required'),
  }),
  body: z.object({
    action: z.enum(['REFUND_BUYER', 'RELEASE_SELLER']),
    resolutionNote: z.string().trim().min(5, 'Resolution note is required (min 5 characters)'),
  }),
});

export const adminUpdateSettingsSchema = requestSchema({
  body: z.record(z.string(), z.string()),
});
