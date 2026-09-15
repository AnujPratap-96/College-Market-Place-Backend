import { logger } from '../utils/logger';
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
  } else if (err instanceof ApiError && err.statusCode < 500) {
    // Client/operational error with explicit safe status code
    error = err;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = err.meta?.target;
      const field = Array.isArray(target) ? target.join(', ') : typeof target === 'string' ? target : 'field';
      error = new ApiError(409, `A record with this ${field} already exists.`);
    } else if (err.code === 'P2025') {
      error = new ApiError(404, 'The requested record was not found.');
    } else {
      // Generalize other database request failures as Internal Server Error
      error = new ApiError(500, 'Internal Server Error');
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    // Client passed bad parameter shapes to query
    error = new ApiError(400, 'Invalid request parameters.');
  } else if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError ||
    err instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    // Database infrastructure failures - NEVER leak DB details to client
    error = new ApiError(500, 'Internal Server Error');
  } else {
    // Any other unhandled system / runtime error
    const statusCode = typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 500
      ? err.statusCode
      : 500;
    const message = statusCode < 500 && err.message
      ? err.message
      : 'Internal Server Error';
    error = new ApiError(statusCode, message, null);
  }

  // Server-side logging: Full details and stack trace preserved for developers
  if (error.statusCode >= 500) {
    logger.error(`[${req.id || 'REQ'}] [SYSTEM ERROR] ${req.method} ${req.originalUrl} - ${error.statusCode}:`, err);
    if (err?.stack) {
      logger.error(err.stack);
    }
  } else {
    logger.warn(`[${req.id || 'REQ'}] [CLIENT ERROR] ${req.method} ${req.originalUrl} - ${error.statusCode}: ${error.message}`);
  }

  errorResponse(res, {
    statusCode: error.statusCode,
    message: error.message,
    error: error.details ?? null,
  });
}
