import prisma from '../../lib/prisma';
import {
  Subscription,
  SubscriptionDelivery,
  SubscriptionStatus,
  DeliveryScheduleStatus,
  Prisma,
} from '@prisma/client';

export class SubscriptionRepository {
  async createWithDeliveries(
    subscriptionData: Prisma.SubscriptionUncheckedCreateInput,
    deliveriesData: { scheduledDate: Date; note?: string }[],
    tx?: Prisma.TransactionClient
  ): Promise<Subscription & { deliveries: SubscriptionDelivery[] }> {
    const client = tx || prisma;
    return client.subscription.create({
      data: {
        ...subscriptionData,
        deliveries: {
          create: deliveriesData,
        },
      },
      include: {
        deliveries: true,
      },
    });
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<any | null> {
    const client = tx || prisma;
    return client.subscription.findUnique({
      where: { id },
      include: {
        product: true,
        subscriber: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            college: true,
            profileImage: true,
          },
        },
        provider: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            college: true,
            profileImage: true,
          },
        },
        deliveries: {
          orderBy: { scheduledDate: 'asc' },
        },
      },
    });
  }

  async findBySubscriber(subscriberId: string): Promise<any[]> {
    return prisma.subscription.findMany({
      where: { subscriberId },
      include: {
        product: true,
        provider: {
          select: {
            id: true,
            name: true,
            phone: true,
            college: true,
          },
        },
        deliveries: {
          orderBy: { scheduledDate: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByProvider(providerId: string): Promise<any[]> {
    return prisma.subscription.findMany({
      where: { providerId },
      include: {
        product: true,
        subscriber: {
          select: {
            id: true,
            name: true,
            phone: true,
            college: true,
          },
        },
        deliveries: {
          orderBy: { scheduledDate: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    id: string,
    data: Prisma.SubscriptionUpdateInput,
    tx?: Prisma.TransactionClient
  ): Promise<Subscription> {
    const client = tx || prisma;
    return client.subscription.update({
      where: { id },
      data,
    });
  }

  async updateDeliveryStatus(
    deliveryId: string,
    status: DeliveryScheduleStatus,
    note?: string,
    tx?: Prisma.TransactionClient
  ): Promise<SubscriptionDelivery> {
    const client = tx || prisma;
    return client.subscriptionDelivery.update({
      where: { id: deliveryId },
      data: { status, note },
    });
  }

  async findDeliveriesBetween(
    subscriptionId: string,
    fromDate: Date,
    toDate: Date,
    tx?: Prisma.TransactionClient
  ): Promise<SubscriptionDelivery[]> {
    const client = tx || prisma;
    return client.subscriptionDelivery.findMany({
      where: {
        subscriptionId,
        scheduledDate: {
          gte: fromDate,
          lte: toDate,
        },
        status: DeliveryScheduleStatus.SCHEDULED,
      },
    });
  }

  async findEndedCycles(now: Date): Promise<any[]> {
    return prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: { lte: now },
      },
      include: {
        product: true,
        subscriber: true,
        provider: true,
        deliveries: true,
      },
    });
  }
}

export const subscriptionRepository = new SubscriptionRepository();
