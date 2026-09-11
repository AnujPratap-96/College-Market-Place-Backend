import { Request, Response } from 'express';
import { userService } from './user.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const user = await userService.getProfile(userId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Profile retrieved successfully',
    data: { user },
  });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const updateData = req.validated?.body || req.body;
  const user = await userService.updateProfile(userId, updateData);
  return successResponse(res, {
    statusCode: 200,
    message: 'Profile updated successfully',
    data: { user },
  });
});
