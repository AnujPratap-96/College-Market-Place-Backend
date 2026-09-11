import { reviewRepository, ReviewRepository } from './review.repository';
import prisma from '../../lib/prisma';
import { ApiError } from '../../utils/api-error';
import { ReviewRole, OrderStatus } from '@prisma/client';
import { emitToUser } from '../../lib/socket';

export class ReviewService {
  constructor(private repo: ReviewRepository = reviewRepository) {}

  async submitReview(reviewerId: string, data: {
    orderId: string;
    rating: number;
    headline?: string;
    comment: string;
    isAnonymous?: boolean;
  }) {
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: {
        product: { select: { id: true, title: true } },
      },
    });

    if (!order) {
      throw new ApiError(404, 'Order not found.');
    }

    if (order.status !== OrderStatus.COMPLETED) {
      throw new ApiError(400, 'Reviews can only be submitted for completed orders.');
    }

    const isBuyer = order.buyerId === reviewerId;
    const isSeller = order.sellerId === reviewerId;

    if (!isBuyer && !isSeller) {
      throw new ApiError(403, 'You are not authorized to review this transaction.');
    }

    const role: ReviewRole = isBuyer ? ReviewRole.BUYER_TO_SELLER : ReviewRole.SELLER_TO_BUYER;
    const revieweeId = isBuyer ? order.sellerId : order.buyerId;

    const existing = await this.repo.findExistingReview(data.orderId, reviewerId, role);
    if (existing) {
      throw new ApiError(400, 'You have already submitted a review for this transaction.');
    }

    const review = await this.repo.createReview({
      orderId: data.orderId,
      productId: order.productId,
      reviewerId,
      revieweeId,
      rating: data.rating,
      headline: data.headline,
      comment: data.comment,
      role,
      isAnonymous: data.isAnonymous,
    });

    const trustMetrics = await this.repo.calculateTrustScore(revieweeId);

    emitToUser(revieweeId, 'new_review_received', {
      reviewId: review.id,
      orderNumber: order.orderNumber,
      rating: data.rating,
      comment: data.comment,
      trustScore: trustMetrics.trustScore,
      badges: trustMetrics.badges,
    });

    return { review, trustMetrics };
  }

  async getUserReviews(userId: string, page = 1, limit = 10) {
    const [reviewsData, trustMetrics, user] = await Promise.all([
      this.repo.findReviewsByReviewee(userId, page, limit),
      this.repo.calculateTrustScore(userId),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          college: true,
          branch: true,
          year: true,
          profileImage: true,
          createdAt: true,
        },
      }),
    ]);

    if (!user) {
      throw new ApiError(404, 'User not found.');
    }

    return {
      user,
      trustMetrics,
      reviews: reviewsData.reviews,
      pagination: reviewsData.pagination,
    };
  }

  async getProductReviews(productId: string, page = 1, limit = 10) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, title: true },
    });

    if (!product) {
      throw new ApiError(404, 'Product not found.');
    }

    return this.repo.findReviewsByProduct(productId, page, limit);
  }

  async getPendingReviews(userId: string) {
    return this.repo.findPendingReviewsForUser(userId);
  }
}

export const reviewService = new ReviewService();
