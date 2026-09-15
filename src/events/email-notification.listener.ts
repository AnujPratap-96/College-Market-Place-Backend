import { logger } from '../utils/logger';
import prisma from '../lib/prisma';
import { domainEvents, OrderCreatedEvent, AuctionSettledEvent, WalletTransferredEvent, DisputeResolvedEvent } from '../lib/events';
import { emailQueue } from '../lib/email-queue';
import { renderBuyerOrderReceiptHtml, renderSellerOrderNotificationHtml } from '../templates/order-receipt.template';
import { renderAuctionWinnerHtml, renderAuctionSellerSoldHtml } from '../templates/auction-settled.template';
import { renderSenderTransferReceiptHtml, renderRecipientTransferCreditHtml } from '../templates/wallet-transfer.template';
import { renderDisputeResolvedHtml } from '../templates/dispute-resolved.template';

export const registerEmailNotificationListeners = (): void => {
  domainEvents.on('order:created', async (payload: OrderCreatedEvent) => {
    try {
      const order = await prisma.order.findUnique({
        where: { id: payload.orderId },
        include: { buyer: true, seller: true, product: true },
      });

      if (!order) return;

      if (order.buyer && order.buyer.email) {
        const { subject, html } = renderBuyerOrderReceiptHtml({
          buyerName: order.buyer.name,
          sellerName: order.seller.name,
          productTitle: order.product.title,
          orderNumber: order.orderNumber,
          orderType: order.orderType,
          totalAmount: order.totalAmount,
          pickupOtp: order.pickupOtp || 'N/A',
        });
        emailQueue.enqueue({ to: order.buyer.email, subject, html });
      }

      if (order.seller && order.seller.email) {
        const { subject, html } = renderSellerOrderNotificationHtml({
          sellerName: order.seller.name,
          buyerName: order.buyer.name,
          productTitle: order.product.title,
          orderNumber: order.orderNumber,
          orderType: order.orderType,
          payoutAmount: order.totalAmount - order.platformFee,
        });
        emailQueue.enqueue({ to: order.seller.email, subject, html });
      }
    } catch (error) {
      logger.error('[EmailNotificationListener] Error processing order:created:', error);
    }
  });

  domainEvents.on('auction:settled', async (payload: AuctionSettledEvent) => {
    try {
      const auction = await prisma.auction.findUnique({
        where: { id: payload.auctionId },
        include: { product: true, order: true, seller: true, currentBidder: true },
      });

      if (!auction || !auction.order) return;

      if (auction.currentBidder && auction.currentBidder.email) {
        const { subject, html } = renderAuctionWinnerHtml({
          winnerName: auction.currentBidder.name,
          sellerName: auction.seller.name,
          productTitle: auction.product.title,
          winningBid: auction.currentBid,
          orderNumber: auction.order.orderNumber,
          pickupOtp: auction.order.pickupOtp || 'N/A',
        });
        emailQueue.enqueue({ to: auction.currentBidder.email, subject, html });
      }

      if (auction.seller && auction.seller.email) {
        const { subject, html } = renderAuctionSellerSoldHtml({
          sellerName: auction.seller.name,
          winnerName: auction.currentBidder ? auction.currentBidder.name : 'Winning Bidder',
          productTitle: auction.product.title,
          winningBid: auction.currentBid,
          orderNumber: auction.order.orderNumber,
          payoutAmount: auction.order.totalAmount - auction.order.platformFee,
        });
        emailQueue.enqueue({ to: auction.seller.email, subject, html });
      }
    } catch (error) {
      logger.error('[EmailNotificationListener] Error processing auction:settled:', error);
    }
  });

  domainEvents.on('wallet:transferred', async (payload: WalletTransferredEvent) => {
    try {
      const [sender, recipient] = await Promise.all([
        prisma.user.findUnique({ where: { id: payload.fromUserId } }),
        prisma.user.findUnique({ where: { id: payload.toUserId } }),
      ]);

      if (!sender || !recipient) return;

      if (sender.email) {
        const { subject, html } = renderSenderTransferReceiptHtml({
          senderName: sender.name,
          recipientName: recipient.name,
          amount: payload.amount,
          transferId: payload.transferRef,
          note: payload.note,
          remainingBalance: payload.senderBalance,
        });
        emailQueue.enqueue({ to: sender.email, subject, html });
      }

      if (recipient.email) {
        const recipientWallet = await prisma.wallet.findUnique({ where: { userId: recipient.id } });
        const { subject, html } = renderRecipientTransferCreditHtml({
          recipientName: recipient.name,
          senderName: sender.name,
          amount: payload.amount,
          transferId: payload.transferRef,
          note: payload.note,
          newBalance: recipientWallet ? recipientWallet.balance : undefined,
        });
        emailQueue.enqueue({ to: recipient.email, subject, html });
      }
    } catch (error) {
      logger.error('[EmailNotificationListener] Error processing wallet:transferred:', error);
    }
  });

  domainEvents.on('dispute:resolved', async (payload: DisputeResolvedEvent) => {
    try {
      const order = await prisma.order.findUnique({
        where: { id: payload.orderId },
        include: { buyer: true, seller: true, product: true },
      });

      if (!order) return;

      if (order.buyer && order.buyer.email) {
        const { subject, html } = renderDisputeResolvedHtml({
          recipientName: order.buyer.name,
          orderNumber: order.orderNumber,
          productTitle: order.product.title,
          decision: payload.decision,
          resolutionNote: payload.resolutionNote,
          amount: order.totalAmount,
        });
        emailQueue.enqueue({ to: order.buyer.email, subject, html });
      }

      if (order.seller && order.seller.email) {
        const { subject, html } = renderDisputeResolvedHtml({
          recipientName: order.seller.name,
          orderNumber: order.orderNumber,
          productTitle: order.product.title,
          decision: payload.decision,
          resolutionNote: payload.resolutionNote,
          amount: order.totalAmount,
        });
        emailQueue.enqueue({ to: order.seller.email, subject, html });
      }
    } catch (error) {
      logger.error('[EmailNotificationListener] Error processing dispute:resolved:', error);
    }
  });
};
