import { Request, Response } from 'express';
import prisma from '../prisma';

export const getMyMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const messages = await prisma.message.findMany({
      where: {
        toUserId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { toUserId, content } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!toUserId || !content) {
      res.status(400).json({ error: 'Recipient and content are required' });
      return;
    }

    if (toUserId === userId) {
      res.status(400).json({ error: 'You cannot message yourself' });
      return;
    }

    const recipient = await prisma.user.findUnique({
      where: { id: toUserId },
    });

    if (!recipient) {
      res.status(404).json({ error: 'Recipient not found' });
      return;
    }

    const newMessage = await prisma.message.create({
      data: {
        toUserId,
        from: userId,
        content,
      },
    });

    res.status(201).json({ message: 'Message sent successfully', data: newMessage });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const getConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const otherUserId = req.params.userId as string;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { from: userId, toUserId: otherUserId },
          { from: otherUserId, toUserId: userId },
        ],
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    res.status(200).json({ messages });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const getConversationsList = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

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

    const conversations = await Promise.all(
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
          orderBy: { createdAt: 'desc' },
        });

        const unreadCount = await prisma.message.count({
          where: {
            from: otherUserId,
            toUserId: userId,
          },
        });

        return {
          user,
          lastMessage,
          unreadCount,
        };
      })
    );

    res.status(200).json({ conversations });
  } catch (error) {
    console.error('Get conversations list error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const fromUserId = req.params.fromUserId as string;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!fromUserId) {
      res.status(400).json({ error: 'fromUserId is required' });
      return;
    }

    await prisma.message.updateMany({
      where: {
        from: fromUserId,
        toUserId: userId,
      },
      data: {},
    });

    res.status(200).json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};
