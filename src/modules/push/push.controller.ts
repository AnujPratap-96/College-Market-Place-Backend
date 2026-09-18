import { Request, Response } from 'express';
import { pushService } from './push.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';

export const subscribePush = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const subscription = req.body;
  
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ success: false, message: 'Invalid subscription' });
  }

  await pushService.saveSubscription(userId, subscription);
  return successResponse(res, { statusCode: 201, message: 'Push subscription saved' });
});
