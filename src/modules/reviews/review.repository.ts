import prisma from '../../lib/prisma';
import { ReviewRole, OrderStatus } from '@prisma/client';

export class ReviewRepository {
  async createReview(data: {
    orderId: string;
    productId?: string | null;
    reviewerId: string;
    revieweeId: string;
    rating: number;
    headline?: string;
    comment: string;
    role: ReviewRole;
    isAnonymous?: boolean;
  }) {
    return prisma.review.create({
      data: {
        orderId: data.orderId,
        productId: data.productId || null,
        reviewerId: data.reviewerId,
        revieweeId: data.revieweeId,
        rating: data.rating,
        headline: data.headline,
        comment: data.comment,
        role: data.role,
        isAnonymous: Boolean(data.isAnonymous),
      },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            college: true,
            branch: true,
          },
        },
        product: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
          },
        },
      },
    });
  }

  async findExistingReview(orderId: string, reviewerId: string, role: ReviewRole) {
    return prisma.review.findUnique({
      where: {
        orderId_reviewerId_role: {
          orderId,
          reviewerId,
          role,
        },
      },
    });
  }

  async findReviewsByReviewee(revieweeId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { revieweeId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: {
            select: {
              id: true,
              name: true,
              profileImage: true,
              college: true,
              branch: true,
            },
          },
          product: {
            select: {
              id: true,
              title: true,
              imageUrl: true,
            },
          },
        },
      }),
      prisma.review.count({ where: { revieweeId } }),
    ]);

    const sanitizedReviews = reviews.map(r => {
      if (r.isAnonymous) {
        return {
          ...r,
          reviewer: {
            id: 'anonymous',
            name: 'Campus Peer',
            profileImage: null,
            college: r.reviewer?.college || 'Campus Student',
            branch: '',
          },
        };
      }
      return r;
    });

    return {
      reviews: sanitizedReviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findReviewsByProduct(productId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { productId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: {
            select: {
              id: true,
              name: true,
              profileImage: true,
              college: true,
              branch: true,
            },
          },
        },
      }),
      prisma.review.count({ where: { productId } }),
    ]);

    const sanitized = reviews.map(r => {
      if (r.isAnonymous) {
        return {
          ...r,
          reviewer: {
            id: 'anonymous',
            name: 'Campus Peer',
            profileImage: null,
            college: r.reviewer?.college || 'Campus Student',
            branch: '',
          },
        };
      }
      return r;
    });

    return {
      reviews: sanitized,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async calculateTrustScore(userId: string) {
    const reviews = await prisma.review.findMany({
      where: { revieweeId: userId },
      select: { rating: true, role: true },
    });

    const totalReviews = reviews.length;
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    if (totalReviews === 0) {
      return {
        trustScore: 4.0,
        rawAverage: 0,
        totalReviews: 0,
        ratingDistribution: distribution,
        badges: [] as string[],
      };
    }

    let sum = 0;
    for (const r of reviews) {
      sum += r.rating;
      if (distribution[r.rating] !== undefined) {
        distribution[r.rating]++;
      }
    }

    const rawAverage = Number((sum / totalReviews).toFixed(2));
    const confidenceWeight = 5;
    const campusBaseline = 4.0;
    const bayesianScore = Number(
      ((confidenceWeight * campusBaseline + sum) / (confidenceWeight + totalReviews)).toFixed(2)
    );

    const badges: string[] = [];
    if (bayesianScore >= 4.7 && totalReviews >= 10) {
      badges.push('TOP_RATED_SELLER');
    }
    if (totalReviews >= 5 && rawAverage >= 4.8) {
      badges.push('COMMUNITY_FAVORITE');
    }

    const completedOrders = await prisma.order.count({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }],
        status: OrderStatus.COMPLETED,
      },
    });

    if (completedOrders >= 15) {
      badges.push('EXPERIENCED_TRADER');
    }

    return {
      trustScore: bayesianScore,
      rawAverage,
      totalReviews,
      ratingDistribution: distribution,
      badges,
    };
  }

  async findPendingReviewsForUser(userId: string) {
    const completedOrders = await prisma.order.findMany({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }],
        status: OrderStatus.COMPLETED,
      },
      include: {
        buyer: { select: { id: true, name: true, profileImage: true } },
        seller: { select: { id: true, name: true, profileImage: true } },
        product: { select: { id: true, title: true, imageUrl: true } },
        reviews: {
          where: { reviewerId: userId },
          select: { id: true },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: 20,
    });

    const pending = completedOrders.filter(o => o.reviews.length === 0);

    return pending.map(o => {
      const isBuyer = o.buyerId === userId;
      return {
        orderId: o.id,
        orderNumber: o.orderNumber,
        orderType: o.orderType,
        totalAmount: o.totalAmount,
        completedAt: o.completedAt,
        targetUser: isBuyer ? o.seller : o.buyer,
        targetRole: isBuyer ? 'SELLER' : 'BUYER',
        product: o.product,
      };
    });
  }
}

export const reviewRepository = new ReviewRepository();
