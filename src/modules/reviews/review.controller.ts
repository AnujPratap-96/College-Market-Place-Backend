import { Request, Response } from 'express';
import { reviewService } from './review.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';

export const submitReview = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const data = req.validated?.body || req.body;
  const result = await reviewService.submitReview(userId, data);
  return successResponse(res, {
    statusCode: 201,
    message: 'Review submitted successfully',
    data: result,
  });
});

export const getUserReviews = asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.params.userId);
  const query = req.validated?.query || req.query;
  const page = parseInt(query.page as string) || 1;
  const limit = parseInt(query.limit as string) || 10;
  const data = await reviewService.getUserReviews(userId, page, limit);
  return successResponse(res, {
    statusCode: 200,
    message: 'User reviews retrieved successfully',
    data,
  });
});

export const getProductReviews = asyncHandler(async (req: Request, res: Response) => {
  const productId = String(req.params.productId);
  const query = req.validated?.query || req.query;
  const page = parseInt(query.page as string) || 1;
  const limit = parseInt(query.limit as string) || 10;
  const data = await reviewService.getProductReviews(productId, page, limit);
  return successResponse(res, {
    statusCode: 200,
    message: 'Product reviews retrieved successfully',
    data,
  });
});

export const getPendingReviews = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const pending = await reviewService.getPendingReviews(userId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Pending reviews retrieved successfully',
    data: { pending },
  });
});
