import { describe, it, expect, vi } from 'vitest';
import errorMiddleware from './error.middleware';
import { ApiError } from '../utils/api-error';
import { z, ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import type { Request, Response, NextFunction } from 'express';

describe('Error Middleware (Sanitization & Error Mapping)', () => {
  const createMockReqRes = () => {
    const req = { id: 'test-req-123', method: 'GET', originalUrl: '/test' } as unknown as Request;
    const res = {
      statusCode: 200,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;
    return { req, res, next };
  };

  it('passes through if no error is present', () => {
    const { req, res, next } = createMockReqRes();
    errorMiddleware(null, req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('correctly returns known operational ApiError', () => {
    const { req, res, next } = createMockReqRes();
    const error = new ApiError(400, 'Insufficient funds');

    errorMiddleware(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Insufficient funds',
      })
    );
  });

  it('maps ZodError to 400 Validation Error without leaking internal stack', () => {
    const { req, res, next } = createMockReqRes();
    const testSchema = z.object({
      password: z.string().min(5, 'Password must be at least 5 characters'),
    });
    const result = testSchema.safeParse({ password: '123' });
    if (result.success) throw new Error('Expected validation failure');
    const zodError = result.error;

    errorMiddleware(zodError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Validation failed',
      })
    );
  });

  it('masks unknown Prisma errors to 500 without leaking database details', () => {
    const { req, res, next } = createMockReqRes();
    const dbError = new Prisma.PrismaClientRustPanicError('FATAL: corrupted memory block in DB connection', '6.0.0');

    errorMiddleware(dbError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Internal Server Error',
      })
    );
    // Ensure raw db error message is not sent to client
    const jsonCall = (res.json as any).mock.calls[0][0];
    expect(JSON.stringify(jsonCall)).not.toContain('corrupted memory');
  });
});
