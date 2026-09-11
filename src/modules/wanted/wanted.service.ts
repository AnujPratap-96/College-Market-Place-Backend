import { wantedRepository, WantedRepository } from './wanted.repository';
import prisma from '../../lib/prisma';
import { ApiError } from '../../utils/api-error';
import { WantedRequestStatus, OfferStatus, OrderStatus, OrderType, LedgerType, ProductStatus, ProductType } from '@prisma/client';
import { emitToUser } from '../../lib/socket';
import { domainEvents } from '../../lib/events';

export class WantedService {
  constructor(private repo: WantedRepository = wantedRepository) {}

  async createRequest(requesterId: string, data: {
    title: string;
    description: string;
    category: string;
    budget: number;
    neededBy: string;
  }) {
    const neededByDate = new Date(data.neededBy);
    if (neededByDate <= new Date()) {
      throw new ApiError(400, 'Needed-by date must be in the future.');
    }

    return this.repo.createRequest({
      requesterId,
      title: data.title,
      description: data.description,
      category: data.category,
      budget: data.budget,
      neededBy: neededByDate,
    });
  }

  async getRequests(filters: {
    category?: string;
    search?: string;
    status?: WantedRequestStatus;
    page?: number;
    limit?: number;
  }) {
    return this.repo.findFilteredRequests(filters);
  }

  async getRequestById(id: string, currentUserId?: string) {
    const request = await this.repo.findById(id);
    if (!request) {
      throw new ApiError(404, 'Wanted request not found.');
    }

    const isRequester = currentUserId && request.requester.id === currentUserId;

    if (!isRequester) {
      const sanitizedOffers = request.offers.filter(o => o.offerer.id === currentUserId);
      return {
        ...request,
        offers: sanitizedOffers,
        totalOffersCount: request.offers.length,
      };
    }

    return {
      ...request,
      totalOffersCount: request.offers.length,
    };
  }

  async submitOffer(offererId: string, requestId: string, data: {
    amount: number;
    pickupLocation: string;
    message?: string;
  }) {
    const request = await this.repo.findById(requestId);
    if (!request) {
      throw new ApiError(404, 'Wanted request not found.');
    }

    if (request.status !== WantedRequestStatus.OPEN) {
      throw new ApiError(400, 'This request is no longer accepting offers.');
    }

    if (new Date(request.neededBy) <= new Date()) {
      throw new ApiError(400, 'This request has expired.');
    }

    if (request.requester.id === offererId) {
      throw new ApiError(400, 'You cannot submit an offer on your own request.');
    }

    const offer = await this.repo.createOffer({
      requestId,
      offererId,
      amount: data.amount,
      pickupLocation: data.pickupLocation,
      message: data.message,
    });

    emitToUser(request.requester.id, 'wanted_offer_received', {
      requestId: request.id,
      requestTitle: request.title,
      offerId: offer.id,
      amount: data.amount,
      pickupLocation: data.pickupLocation,
    });

    return offer;
  }

  async acceptOffer(requesterId: string, offerId: string) {
    const offer = await this.repo.findOfferById(offerId);
    if (!offer) {
      throw new ApiError(404, 'Offer not found.');
    }

    if (offer.request.requesterId !== requesterId) {
      throw new ApiError(403, 'Not authorized to accept this offer.');
    }

    if (offer.request.status !== WantedRequestStatus.OPEN) {
      throw new ApiError(400, 'This request is already resolved or cancelled.');
    }

    if (offer.status !== OfferStatus.PENDING) {
      throw new ApiError(400, 'This offer is no longer pending.');
    }

    const wallet = await prisma.wallet.findUnique({
      where: { userId: requesterId },
    });

    if (!wallet || wallet.balance < offer.amount) {
      throw new ApiError(400, `Insufficient wallet balance. Please top up at least ₹${(offer.amount - (wallet?.balance || 0)).toFixed(2)} to accept this offer.`);
    }

    const pickupOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const orderNumber = 'ORD-WNT-' + Date.now().toString().slice(-6);

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          title: `[Wanted] ${offer.request.title}`,
          description: `Fulfilled via Wanted Board offer by student. Pickup spot: ${offer.pickupLocation}`,
          price: offer.amount,
          type: ProductType.SELL,
          category: offer.request.category,
          status: ProductStatus.SOLD,
          ownerId: offer.offererId,
        },
      });

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore - offer.amount;
      const escrowBefore = wallet.escrowBalance;
      const escrowAfter = escrowBefore + offer.amount;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: balanceAfter,
          escrowBalance: escrowAfter,
        },
      });

      await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          amount: offer.amount,
          type: LedgerType.HOLD,
          balanceBefore,
          balanceAfter,
          escrowBefore,
          escrowAfter,
          referenceType: 'WANTED_OFFER_ESCROW',
          referenceId: offer.id,
          description: `Escrow hold for wanted request: ${offer.request.title}`,
        },
      });

      const order = await tx.order.create({
        data: {
          orderNumber,
          buyerId: requesterId,
          sellerId: offer.offererId,
          productId: product.id,
          price: offer.amount,
          totalAmount: offer.amount,
          platformFee: 0,
          orderType: OrderType.PURCHASE,
          status: OrderStatus.ESCROW_HELD,
          pickupOtp,
        },
        include: {
          product: true,
          seller: { select: { id: true, name: true, college: true, phone: true } },
          buyer: { select: { id: true, name: true, college: true, phone: true } },
        },
      });

      await tx.wantedOffer.update({
        where: { id: offer.id },
        data: {
          status: OfferStatus.ACCEPTED,
          orderId: order.id,
        },
      });

      await tx.wantedRequest.update({
        where: { id: offer.requestId },
        data: {
          status: WantedRequestStatus.FULFILLED,
          acceptedOfferId: offer.id,
        },
      });

      await tx.wantedOffer.updateMany({
        where: {
          requestId: offer.requestId,
          id: { not: offer.id },
          status: OfferStatus.PENDING,
        },
        data: {
          status: OfferStatus.REJECTED,
        },
      });

      return order;
    });

    domainEvents.emit('order:created', {
      orderId: result.id,
    });

    emitToUser(offer.offererId, 'wanted_offer_accepted', {
      requestId: offer.requestId,
      orderId: result.id,
      orderNumber: result.orderNumber,
      amount: offer.amount,
      pickupLocation: offer.pickupLocation,
    });

    return result;
  }

  async cancelRequest(requesterId: string, id: string) {
    const request = await this.repo.findById(id);
    if (!request) {
      throw new ApiError(404, 'Request not found.');
    }

    if (request.requester.id !== requesterId) {
      throw new ApiError(403, 'Not authorized to cancel this request.');
    }

    if (request.status !== WantedRequestStatus.OPEN) {
      throw new ApiError(400, 'Only open requests can be cancelled.');
    }

    await prisma.$transaction([
      prisma.wantedRequest.update({
        where: { id },
        data: { status: WantedRequestStatus.CANCELLED },
      }),
      prisma.wantedOffer.updateMany({
        where: { requestId: id, status: OfferStatus.PENDING },
        data: { status: OfferStatus.EXPIRED },
      }),
    ]);

    return { success: true, message: 'Request cancelled successfully.' };
  }

  async getMyRequests(userId: string) {
    return this.repo.findMyRequests(userId);
  }

  async getMyOffers(userId: string) {
    return this.repo.findMyOffers(userId);
  }
}

export const wantedService = new WantedService();
