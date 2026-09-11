import { Request, Response } from 'express';
import { wantedService } from './wanted.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';
import { WantedRequestStatus } from '@prisma/client';

export const createRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const data = req.validated?.body || req.body;
  const request = await wantedService.createRequest(userId, data);
  return successResponse(res, {
    statusCode: 201,
    message: 'Wanted request posted successfully',
    data: { request },
  });
});

export const getRequests = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validated?.query || req.query;
  const page = parseInt(query.page as string) || 1;
  const limit = parseInt(query.limit as string) || 10;
  const category = query.category as string | undefined;
  const search = query.search as string | undefined;
  const status = query.status as WantedRequestStatus | undefined;

  const data = await wantedService.getRequests({
    category,
    search,
    status,
    page,
    limit,
  });

  return successResponse(res, {
    statusCode: 200,
    message: 'Wanted requests retrieved successfully',
    data,
  });
});

export const getRequestById = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const userId = req.userId;
  const request = await wantedService.getRequestById(id, userId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Wanted request retrieved successfully',
    data: { request },
  });
});

export const submitOffer = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const requestId = String(req.params.id);
  const data = req.validated?.body || req.body;
  const offer = await wantedService.submitOffer(userId, requestId, data);
  return successResponse(res, {
    statusCode: 201,
    message: 'Offer submitted successfully',
    data: { offer },
  });
});

export const acceptOffer = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const offerId = String(req.params.offerId);
  const order = await wantedService.acceptOffer(userId, offerId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Offer accepted and escrow order created successfully',
    data: { order },
  });
});

export const cancelRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const id = String(req.params.id);
  const result = await wantedService.cancelRequest(userId, id);
  return successResponse(res, {
    statusCode: 200,
    message: 'Request cancelled successfully',
    data: result,
  });
});

export const getMyRequests = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const requests = await wantedService.getMyRequests(userId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Your wanted requests retrieved successfully',
    data: { requests },
  });
});

export const getMyOffers = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const offers = await wantedService.getMyOffers(userId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Your offers retrieved successfully',
    data: { offers },
  });
});
