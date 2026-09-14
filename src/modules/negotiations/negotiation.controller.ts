import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { negotiationService } from './negotiation.service';
import { successResponse } from '../../utils/response';

export const createOffer = asyncHandler(async (req: Request, res: Response) => {
  const buyerId = req.userId!;
  const { productId, offeredPrice } = req.body;

  const offer = await negotiationService.createOffer(buyerId, productId, Number(offeredPrice));

  return successResponse(res, {
    statusCode: 201,
    message: 'Negotiation offer created successfully.',
    data: { offer },
  });
});

export const counterOffer = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const id = String(req.params.id);
  const { counterPrice } = req.body;

  const offer = await negotiationService.counterOffer(userId, id, Number(counterPrice));

  return successResponse(res, {
    statusCode: 200,
    message: 'Counter-offer submitted successfully.',
    data: { offer },
  });
});

export const acceptOffer = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const id = String(req.params.id);

  const result = await negotiationService.acceptOffer(userId, id);

  return successResponse(res, {
    statusCode: 200,
    message: 'Offer accepted and order generated successfully.',
    data: result,
  });
});

export const declineOffer = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const id = String(req.params.id);

  const offer = await negotiationService.declineOffer(userId, id);

  return successResponse(res, {
    statusCode: 200,
    message: 'Offer declined successfully.',
    data: { offer },
  });
});

export const getActiveOffer = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const productId = String(req.params.productId);
  const otherUserId = req.query.otherUserId as string | undefined;

  const offer = await negotiationService.getActiveOffer(userId, productId, otherUserId);

  return successResponse(res, {
    statusCode: 200,
    message: 'Active negotiation retrieved successfully.',
    data: { offer },
  });
});
