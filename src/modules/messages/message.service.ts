import { messageRepository, MessageRepository } from './message.repository';
import prisma from '../../lib/prisma';
import { ApiError } from '../../utils/api-error';
import { emitToUser } from '../../lib/socket';

export class MessageService {
  constructor(private repo: MessageRepository = messageRepository) {}

  async getMyMessages(userId: string) {
    return this.repo.findReceivedByUser(userId);
  }

  async sendMessage(fromUserId: string, toUserId: string, content: string, productId?: string) {
    if (!toUserId || !content) {
      throw new ApiError(400, 'toUserId and content are required.');
    }

    if (fromUserId === toUserId) {
      throw new ApiError(400, 'You cannot send a message to yourself.');
    }

    const recipient = await prisma.user.findUnique({ where: { id: toUserId } });
    if (!recipient) {
      throw new ApiError(404, 'Recipient user not found.');
    }

    if (productId) {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) {
        throw new ApiError(404, 'Referenced product not found.');
      }
    }

    const message = await this.repo.create(toUserId, fromUserId, content, productId);

    // Real-time Socket Notification
    try {
      emitToUser(toUserId, 'receive_message', message);
    } catch {
      // Socket emission optional if socket not connected
    }

    return message;
  }

  async getConversation(userId: string, otherUserId: string, productId?: string) {
    if (!otherUserId) {
      throw new ApiError(400, 'Other user ID is required.');
    }
    return this.repo.findConversation(userId, otherUserId, productId);
  }

  async getConversationsList(userId: string) {
    const sentMessages = await prisma.message.findMany({
      where: { from: userId },
      select: { toUserId: true },
    });

    const receivedMessages = await prisma.message.findMany({
      where: { toUserId: userId },
      select: { from: true },
    });

    const userIds = new Set<string>();
    sentMessages.forEach((m) => userIds.add(m.toUserId));
    receivedMessages.forEach((m) => userIds.add(m.from));

    return Promise.all(
      Array.from(userIds).map(async (otherUserId) => {
        const user = await prisma.user.findUnique({
          where: { id: otherUserId },
          select: {
            id: true,
            name: true,
            college: true,
            profileImage: true,
          },
        });

        const lastMessage = await prisma.message.findFirst({
          where: {
            OR: [
              { from: userId, toUserId: otherUserId },
              { from: otherUserId, toUserId: userId },
            ],
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
          orderBy: { createdAt: 'desc' },
        });

        const unreadCount = await prisma.message.count({
          where: {
            from: otherUserId,
            toUserId: userId,
            isRead: false,
          },
        });

        return { user, lastMessage, unreadCount };
      })
    );
  }

  async markAsRead(userId: string, fromUserId: string) {
    if (!fromUserId) {
      throw new ApiError(400, 'fromUserId is required.');
    }
    const result = await this.repo.markAsRead(userId, fromUserId);

    try {
      emitToUser(fromUserId, 'messages_read', { readBy: userId });
    } catch {
      // Socket emission optional
    }

    return result;
  }
}

export const messageService = new MessageService();
