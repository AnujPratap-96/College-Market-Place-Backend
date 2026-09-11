import { Response } from 'express';

export interface SuccessResponseOptions<T = any> {
  statusCode?: number;
  message?: string;
  data?: T;
}

export interface ErrorResponseOptions {
  statusCode?: number;
  message?: string;
  error?: any;
}

export const successResponse = <T>(
  res: Response,
  { statusCode = 200, message = 'Success', data = null as unknown as T }: SuccessResponseOptions<T>
) => {
  const payload: Record<string, any> = {
    success: true,
    message,
  };

  if (data !== null && data !== undefined) {
    payload.data = data;
    if (typeof data === 'object' && !Array.isArray(data)) {
      Object.assign(payload, data);
    }
  }

  return res.status(statusCode).json(payload);
};

export const errorResponse = (
  res: Response,
  { statusCode = 500, message = 'Internal Server Error', error = null }: ErrorResponseOptions
) => {
  const resolvedMessage = error && typeof error === 'string'
    ? error
    : (message || 'Internal Server Error');

  return res.status(statusCode).json({
    success: false,
    message: resolvedMessage,
    error: resolvedMessage,
    details: typeof error === 'object' && error !== null && !(error instanceof Error) ? error : null,
  });
};
