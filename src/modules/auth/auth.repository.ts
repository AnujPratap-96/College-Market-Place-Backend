import prisma from '../../lib/prisma';
import { User, OTP } from '@prisma/client';

export class AuthRepository {
  async findUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  async findUserByPhone(phone: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { phone } });
  }

  async findUserById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async findUserByReferralCode(code: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { referralCode: code } });
  }

  async createUser(data: {
    email: string;
    phone: string;
    password: string;
    name: string;
    college: string;
    branch: string;
    year: string;
    isVerified: boolean;
    referralCode?: string;
    referredById?: string;
  }): Promise<User> {
    return prisma.user.create({ data });
  }

  async updateUserPassword(id: string, passwordHash: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { password: passwordHash },
    });
  }

  async findRecentOtp(email: string, windowSeconds = 60): Promise<OTP | null> {
    return prisma.oTP.findFirst({
      where: {
        email,
        createdAt: {
          gte: new Date(Date.now() - windowSeconds * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createOtp(email: string, code: string, expiresAt: Date): Promise<OTP> {
    return prisma.oTP.create({
      data: { email, code, expiresAt },
    });
  }

  async findValidOtp(email: string, code: string): Promise<OTP | null> {
    return prisma.oTP.findFirst({
      where: {
        email,
        code,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteOtpsForEmail(email: string): Promise<void> {
    await prisma.oTP.deleteMany({ where: { email } });
  }
}

export const authRepository = new AuthRepository();
