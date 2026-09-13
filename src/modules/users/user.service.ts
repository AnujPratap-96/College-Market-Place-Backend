import { userRepository, UserRepository } from './user.repository';
import { ApiError } from '../../utils/api-error';
import prisma from '../../lib/prisma';

export class UserService {
  constructor(private repo: UserRepository = userRepository) {}

  async getProfile(userId: string) {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found.');
    }
    const [reviews, completedTrades, messages] = await Promise.all([
      prisma.review.findMany({
        where: { revieweeId: userId },
        select: { rating: true },
      }),
      prisma.order.count({
        where: {
          OR: [{ buyerId: userId }, { sellerId: userId }],
          status: 'COMPLETED',
        },
      }),
      prisma.message.findMany({
        where: { OR: [{ toUserId: userId }, { from: userId }] },
        select: { from: true, toUserId: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const incoming = messages.filter((message) => message.toUserId === userId);
    const repliedTo = incoming.filter((message) =>
      messages.some(
        (reply) =>
          reply.from === userId &&
          reply.toUserId === message.from &&
          reply.createdAt > message.createdAt
      )
    ).length;
    const averageRating = reviews.length
      ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(2))
      : null;

    const { password, ...safeUser } = user;
    return {
      ...safeUser,
      stats: {
        trustScore: averageRating,
        totalReviews: reviews.length,
        successfulTrades: completedTrades,
        isVerified: user.isVerified,
        responseRate: incoming.length ? Math.round((repliedTo / incoming.length) * 100) : null,
      },
    };
  }

  async updateProfile(userId: string, data: any) {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found.');
    }
    const profileImage = data.profileImage !== undefined ? data.profileImage : data.image;
    const phone = data.phone !== undefined ? data.phone : data.phoneNo;
    const cleanData = {
      ...(data.name && { name: data.name }),
      ...(phone && { phone }),
      ...(data.college && { college: data.college }),
      ...(data.branch && { branch: data.branch }),
      ...(data.year && { year: data.year }),
      ...(profileImage !== undefined && { profileImage }),
    };
    const updated = await this.repo.updateProfile(userId, cleanData);
    const { password, ...safeUser } = updated;
    return safeUser;
  }
}

export const userService = new UserService();
