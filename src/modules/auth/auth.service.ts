import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { authRepository, AuthRepository } from './auth.repository';
import { generateOtp } from '../../utils/generateOtp';
import { sendOtpEmail } from '../../utils/sendOtpEmail';
import { ApiError } from '../../utils/api-error';
import { env } from '../../config/env';

export class AuthService {
  constructor(private repo: AuthRepository = authRepository) {}

  async requestEmailSignup(email: string): Promise<{ message: string; signupToken: string }> {
    const existing = await this.repo.findUserByEmail(email);
    if (existing) {
      throw new ApiError(400, 'User already exists with this email.');
    }

    const recent = await this.repo.findRecentOtp(email, 60);
    if (recent) {
      throw new ApiError(429, 'OTP recently sent. Please wait a minute before requesting again.');
    }

    const { otp, expiresAt } = generateOtp();
    await this.repo.createOtp(email, otp, expiresAt);

    await sendOtpEmail(email, otp, 'SIGNUP');
    const signupToken = jwt.sign({ email, purpose: 'SIGNUP_PENDING' }, env.JWT_SIGNUP_SECRET, { expiresIn: '15m' });
    return { message: 'OTP sent to your email.', signupToken };
  }

  async verifySignupOtp(email: string, otp: string): Promise<{ message: string; signupToken: string }> {
    const validOtp = await this.repo.findValidOtp(email, otp);
    if (!validOtp) {
      throw new ApiError(400, 'Invalid or expired OTP.');
    }

    await this.repo.deleteOtpsForEmail(email);

    const signupToken = jwt.sign({ email, purpose: 'SIGNUP_VERIFIED', verified: true }, env.JWT_SIGNUP_SECRET, { expiresIn: '30m' });

    return { message: 'Email verified successfully.', signupToken };
  }

  async completeSignup(data: {
    email: string;
    phone: string;
    password: string;
    name: string;
    college: string;
    branch: string;
    year: string;
  }): Promise<{ user: any; authToken: string }> {
    const [existingEmail, existingPhone] = await Promise.all([
      this.repo.findUserByEmail(data.email),
      this.repo.findUserByPhone(data.phone),
    ]);

    if (existingEmail) {
      throw new ApiError(400, 'User already registered.');
    }

    if (existingPhone) {
      throw new ApiError(400, 'Phone number is already associated with another account.');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.repo.createUser({
      ...data,
      password: hashedPassword,
      isVerified: true,
    });

    const authToken = jwt.sign({ userId: user.id, role: user.role }, env.JWT_LOGIN_SECRET, { expiresIn: '7d' });

    const { password, ...safeUser } = user;
    return { user: safeUser, authToken };
  }

  async login(email: string, passwordPlain: string): Promise<{ user: any; authToken: string }> {
    const user = await this.repo.findUserByEmail(email);
    if (!user) {
      throw new ApiError(400, 'Invalid email or password.');
    }

    const isMatch = await bcrypt.compare(passwordPlain, user.password);
    if (!isMatch) {
      throw new ApiError(400, 'Invalid email or password.');
    }

    const authToken = jwt.sign({ userId: user.id, role: user.role }, env.JWT_LOGIN_SECRET, { expiresIn: '7d' });

    const { password, ...safeUser } = user;
    return { user: safeUser, authToken };
  }

  async forgotPassword(email: string): Promise<{ message: string; signupToken: string }> {
    const user = await this.repo.findUserByEmail(email);
    if (!user) {
      throw new ApiError(404, 'No account found with this email.');
    }

    const recent = await this.repo.findRecentOtp(email, 60);
    if (recent) {
      throw new ApiError(429, 'OTP recently sent. Please wait a minute before requesting again.');
    }

    const { otp, expiresAt } = generateOtp();
    await this.repo.createOtp(email, otp, expiresAt);
    await sendOtpEmail(email, otp, 'RESET', user.name);

    const resetPendingToken = jwt.sign({ email, purpose: 'RESET_PENDING' }, env.JWT_SIGNUP_SECRET, { expiresIn: '15m' });

    return { message: 'Password reset OTP sent to your email.', signupToken: resetPendingToken };
  }

  async verifyResetOtp(email: string, otp: string): Promise<{ message: string; resetToken: string }> {
    const validOtp = await this.repo.findValidOtp(email, otp);
    if (!validOtp) {
      throw new ApiError(400, 'Invalid or expired OTP.');
    }
    await this.repo.deleteOtpsForEmail(email);
    const resetToken = jwt.sign({ email, purpose: 'RESET_VERIFIED', verified: true }, env.JWT_SIGNUP_SECRET, { expiresIn: '15m' });
    return { message: 'OTP verified. You may now reset your password.', resetToken };
  }

  async resetPassword(email: string, newPasswordPlain: string): Promise<{ message: string }> {
    const user = await this.repo.findUserByEmail(email);
    if (!user) {
      throw new ApiError(404, 'User not found.');
    }

    const hashedPassword = await bcrypt.hash(newPasswordPlain, 10);
    await this.repo.updateUserPassword(user.id, hashedPassword);

    return { message: 'Password reset successfully. Please login with your new password.' };
  }

  async requestLoginOtp(email: string): Promise<{ message: string }> {
    const user = await this.repo.findUserByEmail(email);
    if (!user) {
      throw new ApiError(404, 'No account found with this email. Please sign up first.');
    }

    if (!user.isVerified) {
      throw new ApiError(400, 'Account is not verified. Please complete signup first.');
    }

    const recent = await this.repo.findRecentOtp(email, 60);
    if (recent) {
      throw new ApiError(429, 'OTP recently sent. Please wait a minute before requesting again.');
    }

    const { otp, expiresAt } = generateOtp();
    await this.repo.createOtp(email, otp, expiresAt);
    await sendOtpEmail(email, otp, 'LOGIN', user.name);

    return { message: 'Login OTP sent to your email.' };
  }

  async verifyLoginOtp(email: string, otp: string): Promise<{ user: any; authToken: string }> {
    const validOtp = await this.repo.findValidOtp(email, otp);
    if (!validOtp) {
      throw new ApiError(400, 'Invalid or expired OTP.');
    }

    await this.repo.deleteOtpsForEmail(email);

    const user = await this.repo.findUserByEmail(email);
    if (!user) {
      throw new ApiError(404, 'User not found.');
    }

    const authToken = jwt.sign({ userId: user.id, role: user.role }, env.JWT_LOGIN_SECRET, { expiresIn: '7d' });
    const { password, ...safeUser } = user;
    return { user: safeUser, authToken };
  }

  async resendOtp(email: string, type: 'SIGNUP' | 'RESET' | 'LOGIN'): Promise<{ message: string; signupToken?: string }> {
    if (type === 'SIGNUP') {
      return this.requestEmailSignup(email);
    }
    if (type === 'RESET') {
      return this.forgotPassword(email);
    }
    return this.requestLoginOtp(email);
  }
}

export const authService = new AuthService();
