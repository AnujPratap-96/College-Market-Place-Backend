import prisma from '../../lib/prisma';
import { subscriptionRepository, SubscriptionRepository } from './subscription.repository';
import { walletService } from '../wallet/wallet.service';
import { ApiError } from '../../utils/api-error';
import {
  SubscriptionFrequency,
  SubscriptionStatus,
  DeliveryScheduleStatus,
  ProductType,
} from '@prisma/client';
import { emailQueue } from '../../lib/email-queue';
import { emitToUser } from '../../lib/socket';
import { getPlatformCommissionRate } from '../admin/settings.service';

export class SubscriptionService {
  constructor(private repo: SubscriptionRepository = subscriptionRepository) {}

  async subscribe(
    subscriberId: string,
    data: {
      productId: string;
      deliveryDays: string[];
      deliverySlots?: string;
      autoRenew?: boolean;
    }
  ) {
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (!product) {
      throw new ApiError(404, 'Subscription product or service not found.');
    }

    if (product.type !== ProductType.SUBSCRIPTION) {
      throw new ApiError(400, 'This listing is not configured for subscriptions.');
    }

    if (product.ownerId === subscriberId) {
      throw new ApiError(400, 'You cannot subscribe to your own service.');
    }

    const deliveryDays = data.deliveryDays;
    const durationDays = 30; // Subscriptions billed monthly
    const cycleAmount = product.price;
    const commissionRate = await getPlatformCommissionRate();
    const platformFee = Number((cycleAmount * commissionRate).toFixed(2));

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const nextBillingDate = endDate;
    const subscriptionNumber = `SUB-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const deliveriesData: { scheduledDate: Date; note?: string }[] = [];
    
    for (let i = 1; i <= durationDays; i++) {
      const scheduledDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dayStr = dayNames[scheduledDate.getDay()];
      if (deliveryDays.includes(dayStr)) {
        deliveriesData.push({
          scheduledDate,
          note: data.deliverySlots || product.deliverySlots || undefined,
        });
      }
    }

    return prisma.$transaction(
      async (tx) => {
        const subscription = await this.repo.createWithDeliveries(
          {
            subscriptionNumber,
            subscriberId,
            providerId: product.ownerId,
            productId: product.id,
            deliveryDays,
            cycleAmount,
            platformFee,
            startDate,
            endDate,
            nextBillingDate,
            deliverySlots: data.deliverySlots || product.deliverySlots || undefined,
            autoRenew: data.autoRenew ?? false,
            status: SubscriptionStatus.ACTIVE,
          },
          deliveriesData,
          tx
        );

        // Hold initial cycle fee in escrow
        await walletService.holdSubscriptionEscrow(subscriberId, cycleAmount, subscription.id, tx);

        emitToUser(product.ownerId, 'subscription_new_subscriber', {
          subscriptionId: subscription.id,
          subscriptionNumber: subscription.subscriptionNumber,
          subscriberId,
          message: `A new student has subscribed to your plan (#${subscription.subscriptionNumber})!`,
        });

        return subscription;
      },
      { maxWait: 15000, timeout: 30000 }
    );
  }

  async getMySubscriptions(subscriberId: string) {
    return this.repo.findBySubscriber(subscriberId);
  }

  async getProviderManifest(providerId: string) {
    const subscriptions = await this.repo.findByProvider(providerId);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const todayDeliveries: any[] = [];
    for (const sub of subscriptions) {
      if (sub.status === SubscriptionStatus.ACTIVE) {
        for (const delivery of sub.deliveries) {
          const dStr = new Date(delivery.scheduledDate).toISOString().split('T')[0];
          if (dStr === todayStr && delivery.status === DeliveryScheduleStatus.SCHEDULED) {
            todayDeliveries.push({
              deliveryId: delivery.id,
              subscriptionId: sub.id,
              subscriptionNumber: sub.subscriptionNumber,
              subscriber: sub.subscriber,
              productTitle: sub.product.title,
              deliverySlots: sub.deliverySlots,
            });
          }
        }
      }
    }

    return {
      activeSubscribersCount: subscriptions.filter((s) => s.status === SubscriptionStatus.ACTIVE).length,
      todayDeliveries,
      subscriptions,
    };
  }

  async setVacation(
    subscriberId: string,
    subscriptionId: string,
    vacationFromStr: string,
    vacationToStr: string
  ) {
    const subscription = await this.repo.findById(subscriptionId);
    if (!subscription) {
      throw new ApiError(404, 'Subscription not found.');
    }

    if (subscription.subscriberId !== subscriberId) {
      throw new ApiError(403, 'Not authorized to modify this subscription.');
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new ApiError(400, 'Vacation mode can only be set on active subscriptions.');
    }

    const vacationFrom = new Date(vacationFromStr);
    const vacationTo = new Date(vacationToStr);

    if (vacationFrom >= vacationTo) {
      throw new ApiError(400, 'Vacation end date must be after start date.');
    }

    const pausedDeliveries = await this.repo.findDeliveriesBetween(
      subscriptionId,
      vacationFrom,
      vacationTo
    );

    if (pausedDeliveries.length === 0) {
      throw new ApiError(400, 'No scheduled deliveries fall within the selected vacation range.');
    }

    const totalDeliveriesCount = subscription.deliveries.length || 1;
    const dailyCost = subscription.cycleAmount / totalDeliveriesCount;
    const refundAmount = Number((dailyCost * pausedDeliveries.length).toFixed(2));

    return prisma.$transaction(
      async (tx) => {
        // 1. Mark deliveries as SKIPPED
        for (const del of pausedDeliveries) {
          await this.repo.updateDeliveryStatus(
            del.id,
            DeliveryScheduleStatus.SKIPPED,
            'Paused due to student vacation break',
            tx
          );
        }

        // 2. Update subscription record
        const updated = await this.repo.update(
          subscriptionId,
          {
            vacationFrom,
            vacationTo,
          },
          tx
        );

        // 3. Instant pro-rata refund directly to student's wallet!
        await walletService.refundSubscriptionVacation(
          subscriberId,
          refundAmount,
          subscriptionId,
          pausedDeliveries.length,
          tx
        );

        emitToUser(subscription.providerId, 'subscription_vacation_alert', {
          subscriptionId,
          subscriptionNumber: subscription.subscriptionNumber,
          pausedDays: pausedDeliveries.length,
          message: `Student paused deliveries from ${vacationFrom.toDateString()} to ${vacationTo.toDateString()}`,
        });

        return {
          subscription: updated,
          refundedAmount: refundAmount,
          pausedDaysCount: pausedDeliveries.length,
        };
      },
      { maxWait: 15000, timeout: 30000 }
    );
  }

  async resumeVacation(subscriberId: string, subscriptionId: string) {
    const subscription = await this.repo.findById(subscriptionId);
    if (!subscription) {
      throw new ApiError(404, 'Subscription not found.');
    }

    if (subscription.subscriberId !== subscriberId) {
      throw new ApiError(403, 'Not authorized.');
    }

    return this.repo.update(subscriptionId, {
      vacationFrom: null,
      vacationTo: null,
    });
  }

  async reportMissedDelivery(
    subscriberId: string,
    subscriptionId: string,
    deliveryId: string,
    reason: string
  ) {
    const subscription = await this.repo.findById(subscriptionId);
    if (!subscription) {
      throw new ApiError(404, 'Subscription not found.');
    }

    if (subscription.subscriberId !== subscriberId) {
      throw new ApiError(403, 'Not authorized.');
    }

    const delivery = subscription.deliveries.find((d: any) => d.id === deliveryId);
    if (!delivery) {
      throw new ApiError(404, 'Delivery entry not found.');
    }

    if (delivery.status === DeliveryScheduleStatus.MISSED) {
      throw new ApiError(400, 'This delivery has already been reported as missed.');
    }

    const totalDeliveriesCount = subscription.deliveries.length || 1;
    const dailyCost = Number((subscription.cycleAmount / totalDeliveriesCount).toFixed(2));

    return prisma.$transaction(
      async (tx) => {
        await this.repo.updateDeliveryStatus(
          deliveryId,
          DeliveryScheduleStatus.MISSED,
          `Missed reported by subscriber: ${reason}`,
          tx
        );

        // Refund daily pro-rata amount to student wallet
        await walletService.refundSubscriptionMissed(
          subscriberId,
          dailyCost,
          subscriptionId,
          deliveryId,
          tx
        );

        emitToUser(subscription.providerId, 'subscription_missed_delivery_alert', {
          subscriptionId,
          deliveryId,
          reason,
          message: `A missed delivery was reported on subscription #${subscription.subscriptionNumber}. Pro-rata refund credited to student.`,
        });

        return {
          deliveryId,
          refundedAmount: dailyCost,
          reason,
        };
      },
      { maxWait: 15000, timeout: 30000 }
    );
  }

  async cancelSubscription(subscriberId: string, subscriptionId: string) {
    const subscription = await this.repo.findById(subscriptionId);
    if (!subscription) {
      throw new ApiError(404, 'Subscription not found.');
    }

    if (subscription.subscriberId !== subscriberId) {
      throw new ApiError(403, 'Not authorized to cancel this subscription.');
    }

    return this.repo.update(subscriptionId, {
      autoRenew: false,
      status: SubscriptionStatus.CANCELLED,
    });
  }

  async settleEndedCycles() {
    const now = new Date();
    const endedSubscriptions = await this.repo.findEndedCycles(now);
    const settlements: any[] = [];

    for (const sub of endedSubscriptions) {
      await prisma.$transaction(
        async (tx) => {
          // Count missed/skipped deliveries to calculate final net payout
          const totalDeliveries = sub.deliveries.length || 1;
          const dailyRate = sub.cycleAmount / totalDeliveries;
          const nonRefundedDeliveries = sub.deliveries.filter(
            (d: any) => d.status !== DeliveryScheduleStatus.SKIPPED && d.status !== DeliveryScheduleStatus.MISSED
          ).length;

          const netEscrow = Number((dailyRate * nonRefundedDeliveries).toFixed(2));
          const commissionRate = await getPlatformCommissionRate();
          const platformFee = Number((netEscrow * commissionRate).toFixed(2));
          const providerPayout = Math.max(0, netEscrow - platformFee);

          if (netEscrow > 0) {
            await walletService.settleSubscriptionCycle(
              sub.subscriberId,
              sub.providerId,
              netEscrow,
              providerPayout,
              platformFee,
              sub.id,
              tx
            );
          }

          const updated = await this.repo.update(
            sub.id,
            {
              status: SubscriptionStatus.EXPIRED,
            },
            tx
          );

          emitToUser(sub.providerId, 'subscription_settled', {
            subscriptionId: sub.id,
            payoutAmount: providerPayout,
            message: `Cycle ended for subscription #${sub.subscriptionNumber}. Payout of ₹${providerPayout.toFixed(2)} credited to your wallet.`,
          });

          settlements.push({
            subscriptionId: sub.id,
            netEscrow,
            providerPayout,
            platformFee,
          });
        },
        { maxWait: 15000, timeout: 30000 }
      );
    }

    return { settledCount: settlements.length, settlements };
  }
  async skipDeliveriesOnHolidays() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const scheduledDeliveries = await prisma.subscriptionDelivery.findMany({
      where: {
        status: DeliveryScheduleStatus.SCHEDULED,
        scheduledDate: {
          gte: today,
          lte: endOfDay,
        }
      },
      include: {
        subscription: {
          include: {
            product: { select: { title: true } },
            subscriber: { select: { id: true, email: true, name: true } },
            provider: { select: { id: true, email: true, name: true } },
          }
        }
      }
    });

    if (scheduledDeliveries.length === 0) return;

    for (const del of scheduledDeliveries) {
      const sub = del.subscription;
      const isHoliday = await prisma.holiday.findFirst({
        where: {
          userId: { in: [sub.subscriberId, sub.providerId] },
          startDate: { lte: del.scheduledDate },
          endDate: { gte: del.scheduledDate }
        }
      });

      if (isHoliday) {
        await prisma.$transaction(async (tx) => {
          await tx.subscriptionDelivery.update({
            where: { id: del.id },
            data: { status: DeliveryScheduleStatus.SKIPPED, note: "Skipped automatically due to Holiday" }
          });

          const totalDeliveries = await tx.subscriptionDelivery.count({ where: { subscriptionId: sub.id } });
          const dailyRate = totalDeliveries > 0 ? (sub.cycleAmount / totalDeliveries) : 0;
          
          if (dailyRate > 0) {
             await walletService.refundSubscriptionMissed(
              sub.subscriberId,
              dailyRate,
              sub.id,
              del.id,
              tx as any
            );
          }
        });

        const dateStr = del.scheduledDate.toDateString();
        const subject = `Subscription Delivery Skipped - ${dateStr}`;
        const msgHtml = `<p>Hello,</p><p>The scheduled delivery for <strong>${sub.product.title}</strong> on ${dateStr} has been skipped because today is marked as a holiday.</p><p>A pro-rata refund has been credited to the student\'s wallet.</p>`;

        emailQueue.enqueue({
          to: sub.subscriber.email,
          subject,
          html: msgHtml
        });

        emailQueue.enqueue({
          to: sub.provider.email,
          subject,
          html: msgHtml
        });
      }
    }
  }


}

export const subscriptionService = new SubscriptionService();
