import { Request, Response } from 'express';
import { subscriptionService } from './subscription.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';

export const subscribe = asyncHandler(async (req: Request, res: Response) => {
  const subscriberId = req.userId!;
  const data = req.validated?.body || req.body;
  const subscription = await subscriptionService.subscribe(subscriberId, data);

  return successResponse(res, {
    statusCode: 201,
    message: 'Subscribed successfully and cycle funds held securely in escrow',
    data: { subscription },
  });
});

export const getMySubscriptions = asyncHandler(async (req: Request, res: Response) => {
  const subscriberId = req.userId!;
  const subscriptions = await subscriptionService.getMySubscriptions(subscriberId);

  return successResponse(res, {
    statusCode: 200,
    message: 'My subscriptions retrieved successfully',
    data: { subscriptions },
  });
});

export const getProviderManifest = asyncHandler(async (req: Request, res: Response) => {
  const providerId = req.userId!;
  const manifest = await subscriptionService.getProviderManifest(providerId);

  return successResponse(res, {
    statusCode: 200,
    message: 'Provider delivery manifest retrieved successfully',
    data: manifest,
  });
});

export const setVacation = asyncHandler(async (req: Request, res: Response) => {
  const subscriberId = req.userId!;
  const id = (req.validated?.params?.id || req.params.id) as string;
  const { vacationFrom, vacationTo } = req.validated?.body || req.body;

  const result = await subscriptionService.setVacation(subscriberId, id, vacationFrom, vacationTo);

  return successResponse(res, {
    statusCode: 200,
    message: `Vacation mode activated. Pro-rata refund of ₹${result.refundedAmount.toFixed(2)} credited to your wallet!`,
    data: result,
  });
});

export const resumeVacation = asyncHandler(async (req: Request, res: Response) => {
  const subscriberId = req.userId!;
  const id = (req.validated?.params?.id || req.params.id) as string;
  const subscription = await subscriptionService.resumeVacation(subscriberId, id);

  return successResponse(res, {
    statusCode: 200,
    message: 'Vacation mode cleared and regular delivery schedule resumed',
    data: { subscription },
  });
});

export const reportMissedDelivery = asyncHandler(async (req: Request, res: Response) => {
  const subscriberId = req.userId!;
  const id = (req.validated?.params?.id || req.params.id) as string;
  const { deliveryId, reason } = req.validated?.body || req.body;

  const result = await subscriptionService.reportMissedDelivery(subscriberId, id, deliveryId, reason);

  return successResponse(res, {
    statusCode: 200,
    message: `Missed delivery recorded. Daily pro-rata refund of ₹${result.refundedAmount.toFixed(2)} credited to your wallet!`,
    data: result,
  });
});

export const cancelSubscription = asyncHandler(async (req: Request, res: Response) => {
  const subscriberId = req.userId!;
  const id = (req.validated?.params?.id || req.params.id) as string;
  const subscription = await subscriptionService.cancelSubscription(subscriberId, id);

  return successResponse(res, {
    statusCode: 200,
    message: 'Subscription cancelled successfully. No further renewals will occur.',
    data: { subscription },
  });
});

export const settleEndedCycles = asyncHandler(async (_req: Request, res: Response) => {
  const result = await subscriptionService.settleEndedCycles();

  return successResponse(res, {
    statusCode: 200,
    message: `Cycle settlement complete. ${result.settledCount} subscription(s) settled.`,
    data: result,
  });
});
