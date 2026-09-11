import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { ApiError, mapZodErrors } from '../utils/api-error';
import { errorResponse } from '../utils/response';

export default function errorMiddleware(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!err) {
    next();
    return;
  }

  let error: ApiError;

  if (err instanceof ZodError) {
    const mappedError = mapZodErrors(err);
    error = new ApiError(400, 'Validation failed', mappedError);
  } else if (err instanceof ApiError) {
    error = err;
  } else if (err instanceof Prisma.PrismaClientInitializationError) {
    error = new ApiError(503, 'Database service is currently unavailable. Please try again shortly.');
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = err.meta?.target;
      const field = Array.isArray(target) ? target.join(', ') : typeof target === 'string' ? target : 'field';
      error = new ApiError(409, `A record with this ${field} already exists.`);
    } else if (err.code === 'P2025') {
      error = new ApiError(404, 'The requested record was not found.');
    } else if (['P1000', 'P1001', 'P1002', 'P1008', 'P1017'].includes(err.code)) {
      error = new ApiError(503, 'Database connection could not be established. Please try again shortly.');
    } else {
      error = new ApiError(400, 'Database request could not be processed.');
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    error = new ApiError(400, 'Invalid request data format.');
  } else if (
    err instanceof Prisma.PrismaClientRustPanicError ||
    err instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    error = new ApiError(500, 'An internal database error occurred.');
  } else {
    const statusCode = typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode
      : 500;
    const message = statusCode < 500 && err.message
      ? err.message
      : 'An unexpected server error occurred. Please try again later.';
    error = new ApiError(statusCode, message, null);
  }

  console.error(`[${req.id || 'REQ'}] ${req.method} ${req.originalUrl} - ${error.statusCode}: ${err.message || error.message}`);
  if (err.stack) {
    console.error(err.stack);
  }

  errorResponse(res, {
    statusCode: error.statusCode,
    message: error.message,
    error: error.details ?? null,
  });
}
