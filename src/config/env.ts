import { logger } from '../utils/logger';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  JWT_LOGIN_SECRET: z.string().min(1, 'JWT_LOGIN_SECRET is required'),
  JWT_SIGNUP_SECRET: z.string().min(1, 'JWT_SIGNUP_SECRET is required'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // External Services (Required for full app functionality)
  RAZORPAY_KEY_ID: z.string().min(1, 'RAZORPAY_KEY_ID is required'),
  RAZORPAY_KEY_SECRET: z.string().min(1, 'RAZORPAY_KEY_SECRET is required'),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1, 'RAZORPAY_WEBHOOK_SECRET is required'),
  
  SUPABASE_URL: z.string().min(1, 'SUPABASE_URL is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  SUPABASE_STORAGE_BUCKET: z.string().min(1, 'SUPABASE_STORAGE_BUCKET is required'),
  
  BREVO_API_KEY: z.string().min(1, 'BREVO_API_KEY is required'),
  
  ALGOLIA_APPLICATION_ID: z.string().min(1, 'ALGOLIA_APPLICATION_ID is required'),
  ALGOLIA_ADMIN_API_KEY: z.string().min(1, 'ALGOLIA_ADMIN_API_KEY is required'),
  
  REDIS_DB_URL: z.string().min(1, 'REDIS_DB_URL is required'),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  MISTRAL_API_KEY: z.string().min(1, 'MISTRAL_API_KEY is required'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  logger.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
