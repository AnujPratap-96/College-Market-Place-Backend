import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { errorResponse } from '../utils/response';

export default function errorMiddleware(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!err) {
    return next();
  }

  let error = err;

  
  if (!(err instanceof AppError)) {
    error = new AppError(500, 'Internal Server Error');
  }

  const statusCode = (error as AppError).statusCode || 500;
  const message = error.message || 'Internal Server Error';

  console.error('Error:', {
    path: req.originalUrl,
    method: req.method,
    statusCode,
    message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  });

  const stackTrace = process.env.NODE_ENV !== 'production' ? err.stack : undefined;

  return errorResponse(res, {
    statusCode,
    message,
  });
}