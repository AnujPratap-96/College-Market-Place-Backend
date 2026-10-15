import { messageRepository, MessageRepository } from './message.repository';
import prisma from '../../lib/prisma';
import { ApiError } from '../../utils/api-error';
import { emitToUser } from '../../lib/socket';

export class MessageService {
  constructor(private repo: MessageRepository = messageRepository) {}

  async getMyMessages(userId: string) {
    return this.repo.findReceivedByUser(userId);
  }

  async sendMessage(
    fromUserId: string,
    toUserId: string,
    content: string,
    productId?: string,
    mediaType: 'TEXT' | 'IMAGE' | 'AUDIO' = 'TEXT',
    mediaUrl?: string,
    audioDuration?: number
  ) {
    const finalContent = content?.trim() || (mediaType === 'IMAGE' ? 'Sent a photo' : mediaType === 'AUDIO' ? 'Voice note' : '');
    if (!toUserId || (!finalContent && !mediaUrl)) {
      throw new ApiError(400, 'toUserId and content or media are required.');
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

    const message = await this.repo.create(
      toUserId,
      fromUserId,
      finalContent,
      productId,
      mediaType,
      mediaUrl,
      audioDuration
    );

    try {
      emitToUser(toUserId, 'receive_message', message);
    } catch {}

    return message;
  }

  async getConversation(userId: string, otherUserId: string, productId?: string) {
    if (!otherUserId) {
      throw new ApiError(400, 'Other user ID is required.');
    }
    return this.repo.findConversation(userId, otherUserId, productId);
  }

  async getConversationsList(userId: string) {
    // 1. Fetch recent messages involving this user (ordered desc)
    const recentMessages = await prisma.message.findMany({
      where: {
        OR: [{ from: userId }, { toUserId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
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
      },
    });

    // 2. Identify unique conversation partners & their latest message & unread count
    const conversationMap = new Map<
      string,
      { lastMessage: any; unreadCount: number }
    >();

    for (const msg of recentMessages) {
      const otherId = msg.from === userId ? msg.toUserId : msg.from;
      if (!otherId) continue;

      if (!conversationMap.has(otherId)) {
        conversationMap.set(otherId, {
          lastMessage: msg,
          unreadCount: msg.toUserId === userId && !msg.isRead ? 1 : 0,
        });
      } else {
        if (msg.toUserId === userId && !msg.isRead) {
          conversationMap.get(otherId)!.unreadCount += 1;
        }
      }
    }

    const otherUserIds = Array.from(conversationMap.keys());
    if (otherUserIds.length === 0) return [];

    // 3. Batch fetch all partner profiles in ONE query
    const users = await prisma.user.findMany({
      where: { id: { in: otherUserIds } },
      select: {
        id: true,
        name: true,
        college: true,
        profileImage: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    // 4. Assemble the response in order of most recent interaction
    return otherUserIds.map((otherId) => {
      const conv = conversationMap.get(otherId)!;
      const lastMsg = conv.lastMessage;
      return {
        otherUser: userMap.get(otherId) || null,
        lastMessage: lastMsg
          ? { ...lastMsg, senderId: lastMsg.from, receiverId: lastMsg.toUserId }
          : null,
        unreadCount: conv.unreadCount,
      };
    });
  }

  async markAsRead(userId: string, fromUserId: string) {
    if (!fromUserId) {
      throw new ApiError(400, 'fromUserId is required.');
    }
    const result = await this.repo.markAsRead(userId, fromUserId);

    try {
      emitToUser(fromUserId, 'messages_read', { readBy: userId });
    } catch {}

    return result;
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.repo.countUnread(userId);
  }
}

export const messageService = new MessageService();
