import { logger } from '../utils/logger';
import prisma from './prisma';
import { auctionService } from '../modules/auctions/auction.service';
import { subscriptionService } from '../modules/subscriptions/subscription.service';
import { OrderStatus, OrderType } from '@prisma/client';
import { emitToUser } from './socket';

class BackgroundScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private alertedOverdueOrders = new Set<string>();

  start(intervalMs: number = 60000) {
    if (this.timer) return;

    logger.info(`⏱️  Background scheduler initialized (interval: ${intervalMs / 1000}s)`);

    // Run first iteration shortly after boot
    setTimeout(() => {
      this.runCycle().catch((err) => logger.error('Scheduler initial cycle error:', err));
    }, 5000);

    this.timer = setInterval(() => {
      this.runCycle().catch((err) => logger.error('Scheduler cycle error:', err));
    }, intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async runCycle() {
    if (this.isRunning) return; // Prevent overlapping executions
    this.isRunning = true;

    try {
      // 1. Auto-settle expired auctions
      await auctionService.settleExpiredAuctions();

      // 2. Auto-settle completed subscription billing cycles
      await subscriptionService.settleEndedCycles();

      // 3. Monitor overdue rentals
      await this.checkOverdueRentals();
    } catch (error) {
      logger.error('Scheduler error during maintenance cycle:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async checkOverdueRentals() {
    try {
      const now = new Date();
      const overdueRentals = await prisma.order.findMany({
        where: {
          orderType: OrderType.RENTAL,
          status: OrderStatus.RENTAL_ACTIVE,
          rentalEndDate: {
            lt: now,
          },
        },
        include: {
          product: { select: { title: true } },
          buyer: { select: { id: true, name: true } },
          seller: { select: { id: true, name: true } },
        },
        take: 20,
      });

      for (const order of overdueRentals) {
        // Only alert once per server lifecycle per order to avoid spamming sockets
        if (this.alertedOverdueOrders.has(order.id)) continue;
        this.alertedOverdueOrders.add(order.id);

        emitToUser(order.buyerId, 'rental_overdue_warning', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          productTitle: order.product.title,
          message: `Your rental period for "${order.product.title}" has ended. Please meet the owner to return the item and retrieve your security deposit.`,
        });

        emitToUser(order.sellerId, 'rental_overdue_alert', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          productTitle: order.product.title,
          message: `The rental period for "${order.product.title}" (Rented to ${order.buyer.name}) has passed the scheduled return date.`,
        });
      }
    } catch (err) {
      logger.error('Error checking overdue rentals:', err);
    }
  }
}

export const backgroundScheduler = new BackgroundScheduler();
