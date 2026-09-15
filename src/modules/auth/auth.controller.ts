import { env } from '../../config/env';
import { Request, Response } from 'express';
import { authService } from './auth.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';

export const emailSignup = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.validated?.body || req.body;
  const result = await authService.requestEmailSignup(email);

  res.cookie('signupToken', result.signupToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 60 * 1000,
  });

  return successResponse(res, {
    statusCode: 200,
    message: result.message,
    data: { token: result.signupToken, email },
  });
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const email = req.email!;
  const { otp } = req.validated?.body || req.body;
  const result = await authService.verifySignupOtp(email, otp);

  res.cookie('signupToken', result.signupToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 60 * 1000,
  });

  return successResponse(res, {
    statusCode: 200,
    message: result.message,
    data: { token: result.signupToken },
  });
});

export const completeSignup = asyncHandler(async (req: Request, res: Response) => {
  const email = req.email!;
  const body = req.validated?.body || req.body;
  const result = await authService.completeSignup({
    email,
    ...body,
  });

  res.clearCookie('signupToken');
  res.cookie('authToken', result.authToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return successResponse(res, {
    statusCode: 200,
    message: 'Signup complete! Welcome to College Marketplace.',
    data: {
      user: result.user,
      token: result.authToken,
    },
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.validated?.body || req.body;
  const result = await authService.login(email, password);

  res.cookie('authToken', result.authToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return successResponse(res, {
    statusCode: 200,
    message: 'Logged in successfully',
    data: {
      user: result.user,
      token: result.authToken,
    },
  });
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.clearCookie('authToken');
  return successResponse(res, {
    statusCode: 200,
    message: 'Logged out successfully',
    data: null,
  });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.validated?.body || req.body;
  const result = await authService.forgotPassword(email);

  res.cookie('signupToken', result.signupToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
  });

  return successResponse(res, {
    statusCode: 200,
    message: result.message,
    data: { token: result.signupToken, email },
  });
});

export const verifyResetOtp = asyncHandler(async (req: Request, res: Response) => {
  const email = req.email!;
  const { otp } = req.validated?.body || req.body;
  const result = await authService.verifyResetOtp(email, otp);

  res.cookie('signupToken', result.resetToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
  });

  return successResponse(res, {
    statusCode: 200,
    message: result.message,
    data: { token: result.resetToken },
  });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const email = req.email!;
  const { password } = req.validated?.body || req.body;
  const result = await authService.resetPassword(email, password);
  res.clearCookie('signupToken');

  return successResponse(res, {
    statusCode: 200,
    message: result.message,
    data: null,
  });
});

export const loginOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.validated?.body || req.body;
  const result = await authService.requestLoginOtp(email);

  return successResponse(res, {
    statusCode: 200,
    message: result.message,
    data: { email },
  });
});

export const verifyLoginOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.validated?.body || req.body;
  const result = await authService.verifyLoginOtp(email, otp);

  res.cookie('authToken', result.authToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return successResponse(res, {
    statusCode: 200,
    message: 'Logged in successfully.',
    data: {
      user: result.user,
      token: result.authToken,
    },
  });
});

export const resendOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, type } = req.validated?.body || req.body;
  const result = await authService.resendOtp(email, type);

  if (result.signupToken) {
    res.cookie('signupToken', result.signupToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 60 * 1000,
    });
  }

  return successResponse(res, {
    statusCode: 200,
    message: result.message,
    data: { token: result.signupToken, email },
  });
});
