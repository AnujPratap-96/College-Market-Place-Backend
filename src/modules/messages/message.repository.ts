import prisma from '../../lib/prisma';
import { Message } from '@prisma/client';

export class MessageRepository {
  async findReceivedByUser(userId: string): Promise<any[]> {
    return prisma.message.findMany({
      where: { toUserId: userId },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(toUserId: string, from: string, content: string, productId?: string): Promise<any> {
    return prisma.message.create({
      data: {
        toUserId,
        from,
        content,
        productId: productId || null,
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            imageUrl: true,
          },
        },
      },
    });
  }

  async findConversation(userId: string, otherUserId: string, productId?: string): Promise<any[]> {
    const where: any = {
      OR: [
        { toUserId: userId, from: otherUserId },
        { toUserId: otherUserId, from: userId },
      ],
    };

    if (productId) {
      where.productId = productId;
    }

    return prisma.message.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async markAsRead(toUserId: string, fromUserId: string) {
    return prisma.message.updateMany({
      where: {
        toUserId,
        from: fromUserId,
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  async countUnread(userId: string): Promise<number> {
    return prisma.message.count({
      where: {
        toUserId: userId,
        isRead: false,
      },
    });
  }
}

export const messageRepository = new MessageRepository();
