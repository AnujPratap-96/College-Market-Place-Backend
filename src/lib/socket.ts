import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { messageService } from '../modules/messages/message.service';

let io: SocketIOServer | null = null;

export const initSocket = (httpServer: HttpServer): SocketIOServer => {
  const allowedOrigins = (env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map((o) => o.trim());

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Socket Authentication Middleware
  io.use((socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1] ||
        extractCookie(socket.handshake.headers?.cookie, 'authToken');

      if (!token) {
        return next(new Error('Authentication error: Token required'));
      }

      const decoded = jwt.verify(token, env.JWT_LOGIN_SECRET) as { userId: string };
      socket.data.userId = decoded.userId;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    const userRoom = `user_${userId}`;
    socket.join(userRoom);

    socket.on('send_message', async (data: { toUserId: string; content: string; productId?: string; mediaType?: 'TEXT' | 'IMAGE' | 'AUDIO'; mediaUrl?: string; audioDuration?: number }, callback) => {
      try {
        const savedMessage = await messageService.sendMessage(
          userId,
          data.toUserId,
          data.content,
          data.productId,
          data.mediaType,
          data.mediaUrl,
          data.audioDuration
        );

        if (typeof callback === 'function') {
          callback({ success: true, message: savedMessage });
        }
      } catch (error: any) {
        if (typeof callback === 'function') {
          callback({ success: false, error: error.message });
        }
      }
    });

    // 2. Typing indicator
    socket.on('typing', (data: { toUserId: string; isTyping: boolean }) => {
      io?.to(`user_${data.toUserId}`).emit('user_typing', {
        fromUserId: userId,
        isTyping: data.isTyping,
      });
    });

    // 3. Read receipt
    socket.on('mark_read', async (data: { fromUserId: string }) => {
      try {
        await messageService.markAsRead(userId, data.fromUserId);
        io?.to(`user_${data.fromUserId}`).emit('messages_read', {
          readBy: userId,
        });
      } catch (error) {
        console.error('Socket mark_read error:', error);
      }
    });

    socket.on('join_auction', (auctionId: string) => {
      if (auctionId) {
        socket.join(`auction_${auctionId}`);
      }
    });

    socket.on('leave_auction', (auctionId: string) => {
      if (auctionId) {
        socket.leave(`auction_${auctionId}`);
      }
    });

    socket.on('disconnect', () => {
      socket.leave(userRoom);
    });
  });

  return io;
};

export const getIo = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.io has not been initialized. Call initSocket first.');
  }
  return io;
};

export const emitToUser = (userId: string, event: string, payload: any): void => {
  if (io) {
    io.to(`user_${userId}`).emit(event, payload);
  }
};

export const emitToAuction = (auctionId: string, event: string, payload: any): void => {
  if (io) {
    io.to(`auction_${auctionId}`).emit(event, payload);
  }
};

function extractCookie(cookieHeader?: string, name?: string): string | null {
  if (!cookieHeader || !name) return null;
  const match = cookieHeader.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
}
