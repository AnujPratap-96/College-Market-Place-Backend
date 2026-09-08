import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response';

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  if (!res.headersSent) {
    return errorResponse(res, {
      statusCode: 404,
      message: `Route ${req.originalUrl} not found`,
    });
  }
  next();
};