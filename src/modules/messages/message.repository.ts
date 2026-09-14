import prisma from '../../lib/prisma';
import { Message, MessageMediaType } from '@prisma/client';

const normalizeMessage = (message: any) => ({
  ...message,
  senderId: message.senderId || message.from,
  receiverId: message.receiverId || message.toUserId,
  mediaType: message.mediaType || 'TEXT',
  mediaUrl: message.mediaUrl || null,
  audioDuration: message.audioDuration || null,
  product: message.product
    ? { ...message.product, type: message.product.type || 'SELL' }
    : message.product,
});

export class MessageRepository {
  async findReceivedByUser(userId: string): Promise<any[]> {
    const messages = await prisma.message.findMany({
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
    return messages.map(normalizeMessage);
  }

  async create(
    toUserId: string,
    from: string,
    content: string,
    productId?: string,
    mediaType: MessageMediaType = 'TEXT',
    mediaUrl?: string,
    audioDuration?: number
  ): Promise<any> {
    const message = await prisma.message.create({
      data: {
        toUserId,
        from,
        content,
        productId: productId || null,
        mediaType,
        mediaUrl: mediaUrl || null,
        audioDuration: audioDuration ? Number(audioDuration) : null,
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            imageUrl: true,
            type: true,
          },
        },
        offer: {
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
        },
      },
    });
    return normalizeMessage(message);
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

    const messages = await prisma.message.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            imageUrl: true,
            type: true,
          },
        },
        offer: {
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
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return messages.map(normalizeMessage);
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
