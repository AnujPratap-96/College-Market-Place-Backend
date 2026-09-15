import { logger } from '../../utils/logger';
import prisma from '../../lib/prisma';
import { ApiError } from '../../utils/api-error';
import {
  ProductType,
  ProductStatus,
  AuctionStatus,
  OrderType,
  OrderStatus,
  OrderPaymentMethod,
} from '@prisma/client';
import { walletService } from '../wallet/wallet.service';
import { settingsService } from '../admin/settings.service';
import { emitToAuction, emitToUser } from '../../lib/socket';
import { CreateAuctionInput } from './auction.schema';
import { domainEvents } from '../../lib/events';

export class AuctionService {
  async createAuction(sellerId: string, input: CreateAuctionInput) {
    const durationHours = input.durationHours ?? 24;
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + durationHours * 3600 * 1000);

    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          title: input.title,
          description: input.description,
          price: input.startingBid,
          category: input.category,
          type: ProductType.AUCTION,
          imageUrl: input.imageUrl,
          status: ProductStatus.AVAILABLE,
          ownerId: sellerId,
        },
      });

      const auction = await tx.auction.create({
        data: {
          productId: product.id,
          sellerId,
          startingBid: input.startingBid,
          currentBid: input.startingBid,
          minIncrement: input.minIncrement ?? 50,
          reservePrice: input.reservePrice,
          startTime,
          endTime,
          antiSnipingSeconds: input.antiSnipingSeconds ?? 60,
          status: AuctionStatus.PENDING,
        },
        include: {
          product: true,
          seller: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              college: true,
              profileImage: true,
            },
          },
        },
      });

      emitToUser(sellerId, 'auction_submitted', {
        auctionId: auction.id,
        productTitle: product.title,
        message: 'Your auction has been submitted for campus admin approval and will go live once verified.',
      });

      return auction;
    });
  }

  async getAuctions(filters?: { status?: AuctionStatus; category?: string; query?: string }) {
    await this.settleExpiredAuctions();

    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    } else {
      // By default, only show approved, active, extended, or completed auctions in public arena
      where.status = { in: [AuctionStatus.ACTIVE, AuctionStatus.EXTENDED, AuctionStatus.ENDED] };
    }

    if (filters?.category && filters.category !== 'ALL') {
      where.product = {
        category: filters.category,
      };
    }

    if (filters?.query) {
      where.product = {
        ...(where.product || {}),
        title: { contains: filters.query, mode: 'insensitive' },
      };
    }

    return prisma.auction.findMany({
      where,
      include: {
        product: true,
        seller: {
          select: {
            id: true,
            name: true,
            college: true,
            profileImage: true,
          },
        },
        currentBidder: {
          select: {
            id: true,
            name: true,
            college: true,
            profileImage: true,
          },
        },
        _count: {
          select: {
            bids: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' },
        { endTime: 'asc' },
      ],
    });
  }

  async getAuctionById(id: string) {
    await this.settleExpiredAuctions();

    const auction = await prisma.auction.findFirst({
      where: {
        OR: [{ id }, { productId: id }],
      },
      include: {
        product: true,
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            college: true,
            profileImage: true,
          },
        },
        currentBidder: {
          select: {
            id: true,
            name: true,
            college: true,
            profileImage: true,
          },
        },
        bids: {
          include: {
            bidder: {
              select: {
                id: true,
                name: true,
                college: true,
                profileImage: true,
              },
            },
          },
          orderBy: {
            amount: 'desc',
          },
          take: 30,
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            pickupOtp: true,
            completedAt: true,
          },
        },
      },
    });

    if (!auction) {
      throw new ApiError(404, 'Auction not found');
    }

    return auction;
  }

  async placeBid(bidderId: string, auctionId: string, amount: number) {
    if (amount <= 0) {
      throw new ApiError(400, 'Bid amount must be positive');
    }

    await this.settleExpiredAuctions();

    return prisma.$transaction(
      async (tx) => {
        const auction = await tx.auction.findUnique({
          where: { id: auctionId },
          include: {
            product: true,
            _count: { select: { bids: true } },
          },
        });

        if (!auction) {
          throw new ApiError(404, 'Auction not found');
        }

        if (auction.status !== AuctionStatus.ACTIVE && auction.status !== AuctionStatus.EXTENDED) {
          throw new ApiError(
            400,
            auction.status === AuctionStatus.PENDING
              ? 'This auction is currently awaiting campus admin approval before bidding begins.'
              : 'Auction is no longer active for bidding.'
          );
        }

        if (new Date() >= auction.endTime) {
          throw new ApiError(400, 'Auction has ended');
        }

        if (auction.sellerId === bidderId) {
          throw new ApiError(400, 'Sellers cannot bid on their own auctions');
        }

        if (auction._count.bids === 0) {
          if (amount < auction.startingBid) {
            throw new ApiError(400, `First bid must be at least starting bid of ₹${auction.startingBid.toFixed(2)}`);
          }
        } else {
          const requiredMin = auction.currentBid + auction.minIncrement;
          if (amount < requiredMin) {
            throw new ApiError(400, `Bid must be at least ₹${requiredMin.toFixed(2)} (current: ₹${auction.currentBid.toFixed(2)} + increment: ₹${auction.minIncrement.toFixed(2)})`);
          }
        }

        const prevBidderId = auction.currentBidderId;
        const prevBidAmount = auction.currentBid;

        await walletService.holdAuctionBid(bidderId, amount, auction.id, tx);

        if (prevBidderId && prevBidderId !== bidderId && auction._count.bids > 0) {
          await walletService.refundAuctionBid(
            prevBidderId,
            prevBidAmount,
            auction.id,
            `Outbid on auction for ${auction.product.title}`,
            tx
          );
        }

        const bid = await tx.bid.create({
          data: {
            auctionId: auction.id,
            bidderId,
            amount,
          },
          include: {
            bidder: {
              select: {
                id: true,
                name: true,
                college: true,
                profileImage: true,
              },
            },
          },
        });

        const remainingMs = auction.endTime.getTime() - Date.now();
        let newEndTime = auction.endTime;
        let isExtended = false;

        if (remainingMs < 30 * 1000) {
          newEndTime = new Date(auction.endTime.getTime() + (auction.antiSnipingSeconds ?? 60) * 1000);
          isExtended = true;
        }

        const updatedAuction = await tx.auction.update({
          where: { id: auction.id },
          data: {
            currentBid: amount,
            currentBidderId: bidderId,
            endTime: newEndTime,
            status: isExtended ? AuctionStatus.EXTENDED : auction.status,
          },
          include: {
            product: true,
            currentBidder: {
              select: {
                id: true,
                name: true,
                college: true,
                profileImage: true,
              },
            },
          },
        });

        return {
          auction: updatedAuction,
          bid,
          isExtended,
          newEndTime,
          prevBidderId,
          prevBidAmount,
        };
      },
      { maxWait: 15000, timeout: 30000 }
    ).then((result) => {
      emitToAuction(auctionId, 'new_bid', {
        auctionId,
        bidId: result.bid.id,
        amount: result.bid.amount,
        bidder: result.bid.bidder,
        endTime: result.newEndTime,
        isExtended: result.isExtended,
        currentBid: result.auction.currentBid,
      });

      if (result.prevBidderId && result.prevBidderId !== bidderId) {
        emitToUser(result.prevBidderId, 'outbid_alert', {
          auctionId,
          productTitle: result.auction.product.title,
          newAmount: result.bid.amount,
          refundedAmount: result.prevBidAmount,
        });
      }

      emitToUser(result.auction.sellerId, 'new_bid_on_auction', {
        auctionId,
        productTitle: result.auction.product.title,
        amount: result.bid.amount,
        bidderName: result.bid.bidder.name,
      });

      return {
        auction: result.auction,
        bid: result.bid,
        isExtended: result.isExtended,
      };
    });
  }

  async settleAuction(auctionId: string) {
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        product: true,
        currentBidder: true,
      },
    });

    if (!auction) return null;
    if (auction.status === AuctionStatus.ENDED || auction.status === AuctionStatus.CANCELLED) {
      return auction;
    }

    if (Date.now() < auction.endTime.getTime()) {
      return auction;
    }

    const commissionRate = await settingsService.getPlatformCommissionRate();

    return prisma.$transaction(async (tx) => {
      if (auction.currentBidderId) {
        if (auction.reservePrice && auction.currentBid < auction.reservePrice) {
          await walletService.refundAuctionBid(
            auction.currentBidderId,
            auction.currentBid,
            auction.id,
            `Reserve price not met for auction: ${auction.product.title}`,
            tx
          );

          await tx.product.update({
            where: { id: auction.productId },
            data: { status: ProductStatus.AVAILABLE },
          });

          return tx.auction.update({
            where: { id: auction.id },
            data: { status: AuctionStatus.ENDED },
            include: { product: true },
          });
        }

        const platformFee = Number((auction.currentBid * commissionRate).toFixed(2));
        const pickupOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const orderNumber = `AUC-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

        const order = await tx.order.create({
          data: {
            orderNumber,
            buyerId: auction.currentBidderId,
            sellerId: auction.sellerId,
            productId: auction.productId,
            price: auction.currentBid,
            platformFee,
            totalAmount: auction.currentBid,
            orderType: OrderType.AUCTION,
            status: OrderStatus.ESCROW_HELD,
            paymentMethod: OrderPaymentMethod.WALLET,
            pickupOtp,
          },
        });

        await tx.bid.updateMany({
          where: {
            auctionId: auction.id,
            bidderId: auction.currentBidderId,
            amount: auction.currentBid,
          },
          data: {
            isWinning: true,
          },
        });

        await tx.product.update({
          where: { id: auction.productId },
          data: { status: ProductStatus.SOLD },
        });

        const settledAuction = await tx.auction.update({
          where: { id: auction.id },
          data: {
            status: AuctionStatus.ENDED,
            orderId: order.id,
          },
          include: {
            product: true,
            order: true,
          },
        });

        return settledAuction;
      } else {
        await tx.product.update({
          where: { id: auction.productId },
          data: { status: ProductStatus.AVAILABLE },
        });

        return tx.auction.update({
          where: { id: auction.id },
          data: { status: AuctionStatus.ENDED },
          include: { product: true },
        });
      }
    }, { maxWait: 10000, timeout: 25000 }).then((settled) => {
      emitToAuction(auctionId, 'auction_ended', {
        auctionId,
        winningBid: auction.currentBid,
        winnerId: auction.currentBidderId,
        orderId: settled.orderId,
      });

      if (auction.currentBidderId) {
        emitToUser(auction.currentBidderId, 'auction_won', {
          auctionId,
          productTitle: auction.product.title,
          amount: auction.currentBid,
          orderId: settled.orderId,
        });
      }

      emitToUser(auction.sellerId, 'auction_sold', {
        auctionId,
        productTitle: auction.product.title,
        amount: auction.currentBid,
        orderId: settled.orderId,
      });

      domainEvents.emit('auction:settled', {
        auctionId: auction.id,
        orderId: settled.orderId || undefined,
        winningBid: auction.currentBid,
        winnerId: auction.currentBidderId || undefined,
        sellerId: auction.sellerId,
      });

      return settled;
    });
  }

  async settleExpiredAuctions() {
    const expiredAuctions = await prisma.auction.findMany({
      where: {
        status: { in: [AuctionStatus.ACTIVE, AuctionStatus.EXTENDED] },
        endTime: { lte: new Date() },
      },
      select: { id: true },
      take: 20,
    });

    for (const item of expiredAuctions) {
      try {
        await this.settleAuction(item.id);
      } catch (err) {
        logger.error(`Error auto-settling auction ${item.id}:`, err);
      }
    }
  }

  async getPendingAuctions() {
    return prisma.auction.findMany({
      where: { status: AuctionStatus.PENDING },
      include: {
        product: true,
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            college: true,
            branch: true,
            year: true,
            profileImage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveAuction(auctionId: string, durationHours?: number) {
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: { product: true, seller: true },
    });

    if (!auction) {
      throw new ApiError(404, 'Auction not found.');
    }

    if (auction.status !== AuctionStatus.PENDING) {
      throw new ApiError(400, `Auction is not pending approval (current status: ${auction.status}).`);
    }

    const duration = durationHours || 24;
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + duration * 3600 * 1000);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: auction.productId },
        data: { status: ProductStatus.AVAILABLE },
      });

      return tx.auction.update({
        where: { id: auction.id },
        data: {
          status: AuctionStatus.ACTIVE,
          startTime,
          endTime,
        },
        include: {
          product: true,
          seller: {
            select: {
              id: true,
              name: true,
              college: true,
              profileImage: true,
            },
          },
        },
      });
    });

    emitToAuction(auction.id, 'auction_approved', {
      auctionId: auction.id,
      endTime,
    });

    emitToUser(auction.sellerId, 'auction_approved', {
      auctionId: auction.id,
      productTitle: auction.product.title,
      endTime,
      message: `Your auction for "${auction.product.title}" has been approved and is now live!`,
    });

    return updated;
  }

  async rejectAuction(auctionId: string, reason?: string) {
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: { product: true },
    });

    if (!auction) {
      throw new ApiError(404, 'Auction not found.');
    }

    if (auction.status !== AuctionStatus.PENDING) {
      throw new ApiError(400, `Auction is not pending approval (current status: ${auction.status}).`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: auction.productId },
        data: { status: ProductStatus.AVAILABLE },
      });

      return tx.auction.update({
        where: { id: auction.id },
        data: { status: AuctionStatus.CANCELLED },
        include: { product: true },
      });
    });

    emitToUser(auction.sellerId, 'auction_rejected', {
      auctionId: auction.id,
      productTitle: auction.product.title,
      reason: reason || 'Listing does not comply with campus auction guidelines.',
      message: `Your auction for "${auction.product.title}" was not approved: ${reason || 'Campus policy violation'}.`,
    });

    return updated;
  }

  async cancelAuction(userId: string, auctionId: string, isAdmin: boolean = false, reason?: string) {
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        product: true,
        currentBidder: true,
      },
    });

    if (!auction) {
      throw new ApiError(404, 'Auction not found.');
    }

    if (!isAdmin && auction.sellerId !== userId) {
      throw new ApiError(403, 'You are not authorized to cancel this auction.');
    }

    if (auction.status === AuctionStatus.ENDED || auction.status === AuctionStatus.CANCELLED) {
      throw new ApiError(400, 'Auction has already ended or been cancelled.');
    }

    return prisma.$transaction(async (tx) => {
      if (auction.currentBidderId && auction.currentBid > 0) {
        await walletService.refundAuctionBid(
          auction.currentBidderId,
          auction.currentBid,
          auction.id,
          reason || `Auction cancelled by ${isAdmin ? 'admin' : 'seller'}`,
          tx
        );
      }

      await tx.product.update({
        where: { id: auction.productId },
        data: { status: ProductStatus.AVAILABLE },
      });

      const cancelled = await tx.auction.update({
        where: { id: auction.id },
        data: { status: AuctionStatus.CANCELLED },
        include: { product: true },
      });

      if (auction.currentBidderId) {
        emitToUser(auction.currentBidderId, 'auction_cancelled', {
          auctionId: auction.id,
          productTitle: auction.product.title,
          refundedAmount: auction.currentBid,
          message: `Auction for "${auction.product.title}" was cancelled. Your ₹${auction.currentBid.toFixed(2)} bid has been refunded to your wallet.`,
        });
      }

      emitToAuction(auction.id, 'auction_cancelled', {
        auctionId: auction.id,
        reason: reason || 'Auction cancelled',
      });

      return cancelled;
    });
  }
}

export const auctionService = new AuctionService();
