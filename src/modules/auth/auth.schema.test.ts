import { describe, it, expect } from 'vitest';
import { emailSignupSchema, completeSignupSchema, loginSchema, verifyOtpSchema } from './auth.schema';

describe('Auth Validation Schemas (Zod)', () => {
  it('validates a correct student email address', () => {
    const valid = emailSignupSchema.safeParse({
      body: { email: 'student@college.edu' },
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.body.email).toBe('student@college.edu');
    }
  });

  it('rejects an invalid email format', () => {
    const invalid = emailSignupSchema.safeParse({
      body: { email: 'not-an-email' },
    });
    expect(invalid.success).toBe(false);
  });

  it('validates a complete signup payload', () => {
    const valid = completeSignupSchema.safeParse({
      body: {
        name: 'Rahul Sharma',
        phone: '9876543210',
        password: 'securepassword123',
        college: 'IIT Delhi',
        branch: 'Computer Science',
        year: '3',
      },
    });
    expect(valid.success).toBe(true);
  });

  it('rejects short password under 6 characters in signup', () => {
    const invalid = completeSignupSchema.safeParse({
      body: {
        name: 'Rahul Sharma',
        phone: '9876543210',
        password: '123',
        college: 'IIT Delhi',
        branch: 'Computer Science',
        year: '3',
      },
    });
    expect(invalid.success).toBe(false);
  });

  it('requires 4-digit OTP', () => {
    const valid = verifyOtpSchema.safeParse({ body: { otp: '1234' } });
    const invalid = verifyOtpSchema.safeParse({ body: { otp: '12' } });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it('validates login payload and trims email', () => {
    const valid = loginSchema.safeParse({
      body: { email: '  User@College.edu  ', password: 'password123' },
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.body.email).toBe('user@college.edu');
    }
  });
});
