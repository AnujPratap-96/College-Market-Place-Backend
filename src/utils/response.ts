import { Response } from 'express';

export const successResponse = (
  res: Response,
  { statusCode = 200, message = 'Success', data = null }
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const errorResponse = (
  res: Response,
  { statusCode = 500, message = 'Internal Server Error', error = undefined as string | undefined }
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error,
  });
};