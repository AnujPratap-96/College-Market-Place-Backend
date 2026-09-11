import { Request, Response } from 'express';
import { requestService } from './request.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';

export const getAllRequests = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const requests = await requestService.getAllRequests(userId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Requests retrieved successfully',
    data: { requests },
  });
});

export const getMySentRequests = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const requests = await requestService.getMySentRequests(userId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Sent requests retrieved successfully',
    data: { requests },
  });
});

export const getMyReceivedRequests = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const requests = await requestService.getMyReceivedRequests(userId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Received requests retrieved successfully',
    data: { requests },
  });
});

export const createRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const requestData = req.validated?.body || req.body;
  const newRequest = await requestService.createRequest(userId, requestData);
  return successResponse(res, {
    statusCode: 201,
    message: 'Request sent successfully',
    data: { request: newRequest },
  });
});

export const acceptRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const id = (req.validated?.params?.id || req.params.id) as string;
  const updatedRequest = await requestService.acceptRequest(id, userId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Request accepted',
    data: { request: updatedRequest },
  });
});

export const rejectRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const id = (req.validated?.params?.id || req.params.id) as string;
  await requestService.rejectRequest(id, userId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Request rejected',
    data: null,
  });
});

export const cancelRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const id = (req.validated?.params?.id || req.params.id) as string;
  await requestService.cancelRequest(id, userId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Request cancelled',
    data: null,
  });
});

export const completeRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const id = (req.validated?.params?.id || req.params.id) as string;
  const paymentMethod = req.validated?.body?.paymentMethod || req.body.paymentMethod;
  const result = await requestService.completeRequest(id, userId, paymentMethod);
  return successResponse(res, {
    statusCode: 200,
    message: 'Request completed successfully',
    data: {
      request: result.request,
      transaction: result.transaction,
    },
  });
});
