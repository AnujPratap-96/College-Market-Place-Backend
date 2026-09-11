import 'express';

declare global {
  namespace Express {
    interface Request {
      id?: string;
      requestId?: string;
      userId?: string;
      email?: string;
      role?: string;
      validated?: any;
    }
  }
}
