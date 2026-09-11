import { requestRepository, RequestRepository } from './request.repository';
import prisma from '../../lib/prisma';
import { ApiError } from '../../utils/api-error';
import { PaymentMethod } from '@prisma/client';
import { getPlatformCommissionRate } from '../admin/settings.service';

export class RequestService {
  constructor(private repo: RequestRepository = requestRepository) {}

  async getAllRequests(userId: string) {
    return this.repo.findAllByUser(userId);
  }

  async getMySentRequests(userId: string) {
    return this.repo.findSentByUser(userId);
  }

  async getMyReceivedRequests(userId: string) {
    return this.repo.findReceivedByUser(userId);
  }

  async createRequest(buyerId: string, data: {
    productId: string;
    message?: string;
    totalAmount: number;
    platformFee?: number;
  }) {
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (!product) {
      throw new ApiError(404, 'Product not found.');
    }

    if (product.ownerId === buyerId) {
      throw new ApiError(400, 'You cannot request your own product.');
    }

    if (product.status !== 'AVAILABLE') {
      throw new ApiError(400, 'Product is no longer available.');
    }

    const commissionRate = await getPlatformCommissionRate();
    const platformFeeAmount = data.platformFee ?? Number((product.price * commissionRate).toFixed(2));

    return this.repo.createRequest({
      productId: data.productId,
      buyerId,
      sellerId: product.ownerId,
      message: data.message || null,
      totalAmount: data.totalAmount,
      platformFee: platformFeeAmount,
    });
  }

  async acceptRequest(requestId: string, sellerId: string) {
    const request = await this.repo.findById(requestId);
    if (!request) {
      throw new ApiError(404, 'Request not found.');
    }

    if (request.sellerId !== sellerId) {
      throw new ApiError(403, 'Not authorized to accept this request.');
    }

    if (request.status !== 'PENDING') {
      throw new ApiError(400, 'Only pending requests can be accepted.');
    }

    return this.repo.updateStatus(requestId, 'ACCEPTED');
  }

  async rejectRequest(requestId: string, sellerId: string) {
    const request = await this.repo.findById(requestId);
    if (!request) {
      throw new ApiError(404, 'Request not found.');
    }

    if (request.sellerId !== sellerId) {
      throw new ApiError(403, 'Not authorized to reject this request.');
    }

    if (request.status !== 'PENDING') {
      throw new ApiError(400, 'Only pending requests can be rejected.');
    }

    return this.repo.cancelOrRejectRequest(requestId, request.productId, 'REJECTED');
  }

  async cancelRequest(requestId: string, buyerId: string) {
    const request = await this.repo.findById(requestId);
    if (!request) {
      throw new ApiError(404, 'Request not found.');
    }

    if (request.buyerId !== buyerId) {
      throw new ApiError(403, 'Not authorized to cancel this request.');
    }

    if (request.status !== 'PENDING' && request.status !== 'ACCEPTED') {
      throw new ApiError(400, 'Request cannot be cancelled in its current state.');
    }

    return this.repo.cancelOrRejectRequest(requestId, request.productId, 'CANCELLED');
  }

  async completeRequest(requestId: string, sellerId: string, paymentMethod: PaymentMethod = 'CASH') {
    const request = await this.repo.findById(requestId);
    if (!request) {
      throw new ApiError(404, 'Request not found.');
    }

    if (request.sellerId !== sellerId) {
      throw new ApiError(403, 'Only the seller can mark a request as completed.');
    }

    if (request.status !== 'ACCEPTED') {
      throw new ApiError(400, 'Request must be accepted before marking as completed.');
    }

    return this.repo.completeRequest(requestId, request.productId, paymentMethod);
  }
}

export const requestService = new RequestService();
