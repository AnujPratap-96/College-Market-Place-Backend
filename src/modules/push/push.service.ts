import prisma from '../../lib/prisma';
import { sendPushNotification } from '../../lib/push';

export class PushService {
  async saveSubscription(userId: string, subscription: any) {
    const existing = await prisma.pushSubscription.findUnique({
      where: { endpoint: subscription.endpoint },
    });

    if (existing) {
      if (existing.userId !== userId) {
        await prisma.pushSubscription.update({
          where: { endpoint: subscription.endpoint },
          data: { userId },
        });
      }
      return existing;
    }

    return prisma.pushSubscription.create({
      data: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
  }

  async sendToUser(userId: string, payload: any) {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    const payloadString = JSON.stringify(payload);

    for (const sub of subscriptions) {
      try {
        await sendPushNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payloadString
        );
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription has expired or is no longer valid
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
      }
    }
  }
}

export const pushService = new PushService();
