import { ZodError } from 'zod';

export class ApiError extends Error {
  statusCode: number;
  details: any;
  isOperational: boolean;

  constructor(statusCode: number, message: string, details: any = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function mapZodErrors(err: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  err.issues.forEach((issue) => {
    const field = issue.path[issue.path.length - 1]?.toString() || 'general';
    errors[field] = issue.message;
  });
  return errors;
}

export { ApiError as AppError };
