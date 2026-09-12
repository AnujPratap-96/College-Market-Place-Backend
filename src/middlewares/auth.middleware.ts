import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/api-error';
import { env } from '../config/env';
import prisma from '../lib/prisma';

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

export const requireOtpPendingAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const token = req.cookies?.signupToken || req.headers.authorization?.split(' ')[1];

  if (!token) {
    throw new ApiError(401, 'Unauthorized, please request an OTP first.');
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SIGNUP_SECRET) as { email: string; purpose?: string };
    req.email = decoded.email;
    next();
  } catch (error) {
    throw new ApiError(401, 'Invalid or expired verification token.');
  }
};

export const requireSignUpAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const token = req.cookies?.signupToken || req.headers.authorization?.split(' ')[1];

  if (!token) {
    throw new ApiError(401, 'Unauthorized, please verify email first.');
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SIGNUP_SECRET) as { email: string; purpose?: string; verified?: boolean };
    
    // SECURITY: Reject tokens that have not passed OTP verification
    if (decoded.purpose !== 'SIGNUP_VERIFIED' && decoded.verified !== true) {
      throw new ApiError(403, 'Email OTP has not been verified. Please verify your OTP first.');
    }

    req.email = decoded.email;
    next();
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'Invalid or expired token.');
  }
};

export const requireResetAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const token = req.cookies?.signupToken || req.headers.authorization?.split(' ')[1];

  if (!token) {
    throw new ApiError(401, 'Unauthorized, please request a password reset first.');
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SIGNUP_SECRET) as { email: string; purpose?: string; verified?: boolean };

    // SECURITY: Reject tokens that have not passed OTP verification
    if (decoded.purpose !== 'RESET_VERIFIED' && decoded.verified !== true) {
      throw new ApiError(403, 'Password reset OTP has not been verified.');
    }

    req.email = decoded.email;
    next();
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
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

export const requireAdmin = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  if (!req.userId) {
    throw new ApiError(401, 'Unauthorized, please login first.');
  }

  if (req.role === 'ADMIN') {
    return next();
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true },
    });

    if (!user || user.role !== 'ADMIN') {
      throw new ApiError(403, 'Access denied. Admin privileges required.');
    }

    req.role = 'ADMIN';
    next();
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(500, 'Internal Server Error');
  }
};

export default requireAuth;
