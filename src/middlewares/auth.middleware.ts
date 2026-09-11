import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/api-error';
import { env } from '../config/env';

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const token = req.cookies?.authToken || req.headers.authorization?.split(' ')[1];

  if (!token) {
    throw new ApiError(401, 'Unauthorized, please login first.');
  }

  try {
    const decoded = jwt.verify(token, env.JWT_LOGIN_SECRET) as { userId: string; role?: string };
    req.userId = decoded.userId;
    req.role = decoded.role;
    next();
  } catch (error) {
    throw new ApiError(401, 'Invalid or expired token.');
  }
};

export const requireSignUpAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const token = req.cookies?.signupToken || req.headers.authorization?.split(' ')[1];

  if (!token) {
    throw new ApiError(401, 'Unauthorized, please verify email first.');
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SIGNUP_SECRET) as { email: string };
    req.email = decoded.email;
    next();
  } catch (error) {
    throw new ApiError(401, 'Invalid or expired token.');
  }
};

export const optionalAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const token = req.cookies?.authToken || req.headers.authorization?.split(' ')[1];
  if (!token) {
    return next();
  }
  try {
    const decoded = jwt.verify(token, env.JWT_LOGIN_SECRET) as { userId: string; role?: string };
    req.userId = decoded.userId;
    req.role = decoded.role;
  } catch {}
  next();
};

export default requireAuth;
