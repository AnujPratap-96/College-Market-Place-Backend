import { Request, Response } from 'express';
import { messageService } from './message.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';
import { uploadService } from '../upload/upload.service';
import { ApiError } from '../../utils/api-error';

export const getMyMessages = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const messages = await messageService.getMyMessages(userId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Messages retrieved successfully',
    data: { messages },
  });
});

export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { toUserId, content, productId, mediaType, mediaUrl, audioDuration } = req.validated?.body || req.body;
  const message = await messageService.sendMessage(
    userId,
    toUserId,
    content,
    productId,
    mediaType,
    mediaUrl,
    audioDuration
  );
  return successResponse(res, {
    statusCode: 201,
    message: 'Message sent successfully',
    data: { message },
  });
});

export const uploadChatMedia = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  if (!req.file) {
    throw new ApiError(400, 'No media file attached.');
  }
  const result = await uploadService.saveChatMedia(userId, {
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    buffer: req.file.buffer,
    size: req.file.size,
  });
  return successResponse(res, {
    statusCode: 200,
    message: 'Media uploaded successfully',
    data: result,
  });
});

export const getConversation = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const otherUserId = (req.validated?.params?.userId || req.params.userId) as string;
  const productId = (req.validated?.query?.productId || req.query.productId) as string | undefined;
  const messages = await messageService.getConversation(userId, otherUserId, productId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Conversation retrieved successfully',
    data: { messages },
  });
});

export const getConversationsList = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const conversations = await messageService.getConversationsList(userId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Conversations list retrieved successfully',
    data: { conversations },
  });
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const fromUserId = (req.validated?.params?.fromUserId || req.params.fromUserId) as string;
  await messageService.markAsRead(userId, fromUserId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Messages marked as read',
    data: null,
  });
});

export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const unreadCount = await messageService.getUnreadCount(userId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Unread count retrieved successfully',
    data: { unreadCount },
  });
});
