import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { assistantService } from './assistant.service';
import { successResponse } from '../../utils/response';

export const chatWithAssistant = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const messages = req.body.messages || [];
  const category = req.body.category;

  const response = await assistantService.handleChat(userId, messages, category);

  return successResponse(res, {
    statusCode: 200,
    message: 'Assistant response generated successfully.',
    data: response,
  });
});
