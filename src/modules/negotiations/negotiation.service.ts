import prisma from '../../lib/prisma';
import { ApiError } from '../../utils/api-error';
import { NegotiationStatus, OrderStatus, OrderType, ProductStatus } from '@prisma/client';
import { emitToUser } from '../../lib/socket';
import { getPlatformCommissionRate } from '../admin/settings.service';
import { walletService } from '../wallet/wallet.service';

export class NegotiationService {
  async createOffer(buyerId: string, productId: string, offeredPrice: number) {
    if (!productId || !offeredPrice || offeredPrice <= 0) {
      throw new ApiError(400, 'Valid product ID and offered price are required.');
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { owner: true },
    });

    if (!product) {
      throw new ApiError(404, 'Product not found.');
    }

    if (product.ownerId === buyerId) {
      throw new ApiError(400, 'You cannot make an offer on your own listing.');
    }

    if (product.status !== ProductStatus.AVAILABLE) {
      throw new ApiError(400, 'Product is no longer available for offers.');
    }

    const existingOffer = await prisma.negotiationOffer.findFirst({
      where: {
        productId,
        buyerId,
        sellerId: product.ownerId,
        status: { in: [NegotiationStatus.PENDING, NegotiationStatus.COUNTERED] },
      },
    });

    if (existingOffer) {
      throw new ApiError(400, 'You already have an active negotiation for this item.');
    }

    const message = await prisma.message.create({
      data: {
        toUserId: product.ownerId,
        from: buyerId,
        content: `Offer: Proposed ₹${offeredPrice.toFixed(2)} (Listed: ₹${product.price})`,
        productId,
      },
    });

    const offer = await prisma.negotiationOffer.create({
      data: {
        productId,
        buyerId,
        sellerId: product.ownerId,
        originalPrice: product.price,
        offeredPrice,
        offeredById: buyerId,
        status: NegotiationStatus.PENDING,
        messageId: message.id,
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            imageUrl: true,
            images: true,
          },
        },
        buyer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        seller: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
      },
    });

    try {
      emitToUser(product.ownerId, 'negotiation_offer', offer);
      emitToUser(product.ownerId, 'receive_message', {
        ...message,
        offer,
      });
    } catch {}

    return offer;
  }

  async counterOffer(userId: string, offerId: string, counterPrice: number) {
    if (!offerId || !counterPrice || counterPrice <= 0) {
      throw new ApiError(400, 'Valid offer ID and counter price are required.');
    }

    const offer = await prisma.negotiationOffer.findUnique({
      where: { id: offerId },
      include: { product: true },
    });

    if (!offer) {
      throw new ApiError(404, 'Negotiation offer not found.');
    }

    if (offer.buyerId !== userId && offer.sellerId !== userId) {
      throw new ApiError(403, 'You are not authorized to counter this offer.');
    }

    if (offer.status !== NegotiationStatus.PENDING && offer.status !== NegotiationStatus.COUNTERED) {
      throw new ApiError(400, `Cannot counter an offer that is ${offer.status.toLowerCase()}.`);
    }

    const otherUserId = offer.buyerId === userId ? offer.sellerId : offer.buyerId;

    const message = await prisma.message.create({
      data: {
        toUserId: otherUserId,
        from: userId,
        content: `Counter-Offer: Proposed ₹${counterPrice.toFixed(2)}`,
        productId: offer.productId,
      },
    });

    const updatedOffer = await prisma.negotiationOffer.update({
      where: { id: offerId },
      data: {
        offeredPrice: counterPrice,
        offeredById: userId,
        status: NegotiationStatus.COUNTERED,
        messageId: message.id,
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            imageUrl: true,
            images: true,
          },
        },
        buyer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        seller: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
      },
    });

    try {
      emitToUser(otherUserId, 'negotiation_counter', updatedOffer);
      emitToUser(otherUserId, 'receive_message', {
        ...message,
        offer: updatedOffer,
      });
    } catch {}

    return updatedOffer;
  }

  async acceptOffer(userId: string, offerId: string) {
    const offer = await prisma.negotiationOffer.findUnique({
      where: { id: offerId },
      include: {
        product: true,
        buyer: true,
        seller: true,
      },
    });

    if (!offer) {
      throw new ApiError(404, 'Negotiation offer not found.');
    }

    if (offer.buyerId !== userId && offer.sellerId !== userId) {
      throw new ApiError(403, 'You are not authorized to accept this offer.');
    }

    if (offer.offeredById === userId) {
      throw new ApiError(400, 'You cannot accept your own offer. The other party must accept.');
    }

    if (offer.status !== NegotiationStatus.PENDING && offer.status !== NegotiationStatus.COUNTERED) {
      throw new ApiError(400, `Cannot accept an offer that is already ${offer.status.toLowerCase()}.`);
    }

    if (offer.product.status !== ProductStatus.AVAILABLE) {
      throw new ApiError(400, 'Product is no longer available.');
    }

    const commissionRate = await getPlatformCommissionRate();
    const platformFee = Number((offer.offeredPrice * commissionRate).toFixed(2));
    const pickupOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const buyerWallet = await prisma.wallet.findUnique({
      where: { userId: offer.buyerId },
    });

    const hasFunds = buyerWallet && buyerWallet.balance >= offer.offeredPrice;
    const orderStatus = hasFunds ? OrderStatus.ESCROW_HELD : OrderStatus.PENDING_PAYMENT;

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
          buyerId: offer.buyerId,
          sellerId: offer.sellerId,
          productId: offer.productId,
          price: offer.offeredPrice,
          platformFee,
          totalAmount: offer.offeredPrice,
          orderType: OrderType.PURCHASE,
          status: orderStatus,
          pickupOtp,
        },
      });

      await tx.product.update({
        where: { id: offer.productId },
        data: { status: ProductStatus.RESERVED },
      });

      if (hasFunds) {
        await walletService.holdEscrow(offer.buyerId, offer.offeredPrice, order.id, tx);
      }

      const acceptedOffer = await tx.negotiationOffer.update({
        where: { id: offerId },
        data: {
          status: NegotiationStatus.ACCEPTED,
          orderId: order.id,
        },
        include: {
          product: {
            select: {
              id: true,
              title: true,
              price: true,
              imageUrl: true,
              images: true,
            },
          },
          buyer: {
            select: {
              id: true,
              name: true,
              profileImage: true,
            },
          },
          seller: {
            select: {
              id: true,
              name: true,
              profileImage: true,
            },
          },
        },
      });

      return { order, acceptedOffer };
    });

    const otherUserId = offer.buyerId === userId ? offer.sellerId : offer.buyerId;

    const message = await prisma.message.create({
      data: {
        toUserId: otherUserId,
        from: userId,
        content: `Deal Agreed! Offer of ₹${offer.offeredPrice} accepted. Order #${result.order.orderNumber} created.`,
        productId: offer.productId,
      },
    });

    try {
      emitToUser(offer.buyerId, 'negotiation_accepted', {
        offer: result.acceptedOffer,
        order: result.order,
      });
      emitToUser(offer.sellerId, 'negotiation_accepted', {
        offer: result.acceptedOffer,
        order: result.order,
      });
      emitToUser(otherUserId, 'receive_message', {
        ...message,
        offer: result.acceptedOffer,
      });
    } catch {}

    return result;
  }

  async declineOffer(userId: string, offerId: string) {
    const offer = await prisma.negotiationOffer.findUnique({
      where: { id: offerId },
    });

    if (!offer) {
      throw new ApiError(404, 'Negotiation offer not found.');
    }

    if (offer.buyerId !== userId && offer.sellerId !== userId) {
      throw new ApiError(403, 'You are not authorized to decline this offer.');
    }

    if (offer.status !== NegotiationStatus.PENDING && offer.status !== NegotiationStatus.COUNTERED) {
      throw new ApiError(400, `Cannot decline an offer that is already ${offer.status.toLowerCase()}.`);
    }

    const updatedOffer = await prisma.negotiationOffer.update({
      where: { id: offerId },
      data: { status: NegotiationStatus.DECLINED },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            imageUrl: true,
            images: true,
          },
        },
        buyer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        seller: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
      },
    });

    const otherUserId = offer.buyerId === userId ? offer.sellerId : offer.buyerId;

    const message = await prisma.message.create({
      data: {
        toUserId: otherUserId,
        from: userId,
        content: `Offer of ₹${offer.offeredPrice} was declined.`,
        productId: offer.productId,
      },
    });

    try {
      emitToUser(otherUserId, 'negotiation_declined', updatedOffer);
      emitToUser(otherUserId, 'receive_message', {
        ...message,
        offer: updatedOffer,
      });
    } catch {}

    return updatedOffer;
  }

  async getActiveOffer(userId: string, productId: string, otherUserId?: string) {
    const where: any = {
      productId,
      status: { in: [NegotiationStatus.PENDING, NegotiationStatus.COUNTERED] },
    };

    if (otherUserId) {
      where.OR = [
        { buyerId: userId, sellerId: otherUserId },
        { buyerId: otherUserId, sellerId: userId },
      ];
    } else {
      where.OR = [{ buyerId: userId }, { sellerId: userId }];
    }

    const offer = await prisma.negotiationOffer.findFirst({
      where,
      include: {
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            imageUrl: true,
            images: true,
          },
        },
        buyer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        seller: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return offer;
  }
}

export const negotiationService = new NegotiationService();
