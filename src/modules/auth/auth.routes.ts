import { Router } from 'express';
import {
  emailSignup,
  verifyOtp,
  completeSignup,
  login,
  logout,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  loginOtp,
  verifyLoginOtp,
  resendOtp,
} from './auth.controller';
import { getProfile, updateProfile } from '../users/user.controller';
import { requireAuth, requireSignUpAuth, requireOtpPendingAuth, requireResetAuth } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  emailSignupSchema,
  verifyOtpSchema,
  completeSignupSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyResetOtpSchema,
  resetPasswordSchema,
  loginOtpSchema,
  verifyLoginOtpSchema,
  resendOtpSchema,
} from './auth.schema';
import { updateProfileSchema } from '../users/user.schema';

const router = Router();

router.post('/signup-email', validate(emailSignupSchema), emailSignup);
router.post('/verify-otp', requireOtpPendingAuth, validate(verifyOtpSchema), verifyOtp);
router.post('/complete-signup', requireSignUpAuth, validate(completeSignupSchema), completeSignup);
router.post('/login', validate(loginSchema), login);
router.post('/login-otp', validate(loginOtpSchema), loginOtp);
router.post('/verify-login-otp', validate(verifyLoginOtpSchema), verifyLoginOtp);
router.post('/resend-otp', validate(resendOtpSchema), resendOtp);
router.post('/logout', requireAuth, logout);

router.get('/profile', requireAuth, getProfile);
router.patch('/profile', requireAuth, validate(updateProfileSchema), updateProfile);

router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/verify-reset-otp', requireOtpPendingAuth, validate(verifyResetOtpSchema), verifyResetOtp);
router.post('/reset-password', requireResetAuth, validate(resetPasswordSchema), resetPassword);

export default router;
