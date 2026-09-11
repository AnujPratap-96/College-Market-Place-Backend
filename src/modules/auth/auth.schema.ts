import { z } from 'zod';
import { requestSchema } from '../../schemas/request.schema';

export const emailSignupSchema = requestSchema({
  body: z.object({
    email: z.string().trim().toLowerCase().email('Invalid email address'),
  }),
});

export const verifyOtpSchema = requestSchema({
  body: z.object({
    otp: z.string().trim().min(4, 'OTP must be at least 4 characters'),
  }),
});

export const completeSignupSchema = requestSchema({
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters'),
    phone: z.string().trim().min(10, 'Valid phone number is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    college: z.string().trim().min(2, 'College name is required'),
    branch: z.string().trim().min(2, 'Branch is required'),
    year: z.string().trim().min(1, 'Year is required'),
  }),
});

export const loginSchema = requestSchema({
  body: z.object({
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const forgotPasswordSchema = requestSchema({
  body: z.object({
    email: z.string().trim().toLowerCase().email('Invalid email address'),
  }),
});

export const verifyResetOtpSchema = requestSchema({
  body: z.object({
    otp: z.string().trim().min(4, 'OTP is required'),
  }),
});

export const resetPasswordSchema = requestSchema({
  body: z.object({
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

export const loginOtpSchema = requestSchema({
  body: z.object({
    email: z.string().trim().toLowerCase().email('Invalid email address'),
  }),
});

export const verifyLoginOtpSchema = requestSchema({
  body: z.object({
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    otp: z.string().trim().length(6, 'OTP must be 6 digits'),
  }),
});

export const resendOtpSchema = requestSchema({
  body: z.object({
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    type: z.enum(['SIGNUP', 'RESET', 'LOGIN']).default('SIGNUP'),
  }),
});
