import { Request, Response } from 'express';
import { auctionService } from './auction.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';

export const createAuction = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = req.userId!;
  const data = req.validated?.body || req.body;
  const auction = await auctionService.createAuction(sellerId, data);

  return successResponse(res, {
    statusCode: 201,
    message: 'Auction listing created successfully',
    data: { auction },
  });
});

export const getAuctions = asyncHandler(async (req: Request, res: Response) => {
  const { status, category, query } = req.query as {
    status?: any;
    category?: string;
    query?: string;
  };

  const auctions = await auctionService.getAuctions({ status, category, query });

  return successResponse(res, {
    statusCode: 200,
    message: 'Auctions retrieved successfully',
    data: { auctions },
  });
});

export const getAuctionById = asyncHandler(async (req: Request, res: Response) => {
  const id = (req.validated?.params?.id || req.params.id) as string;
  const auction = await auctionService.getAuctionById(id);

  return successResponse(res, {
    statusCode: 200,
    message: 'Auction details retrieved successfully',
    data: { auction },
  });
});

export const placeBid = asyncHandler(async (req: Request, res: Response) => {
  const bidderId = req.userId!;
  const id = (req.validated?.params?.id || req.params.id) as string;
  const { amount } = req.validated?.body || req.body;

  const result = await auctionService.placeBid(bidderId, id, Number(amount));

  return successResponse(res, {
    statusCode: 200,
    message: 'Bid placed successfully and funds held in escrow',
    data: result,
  });
});

export const settleAuction = asyncHandler(async (req: Request, res: Response) => {
  const id = (req.validated?.params?.id || req.params.id) as string;
  const auction = await auctionService.settleAuction(id);

  return successResponse(res, {
    statusCode: 200,
    message: 'Auction settlement executed',
    data: { auction },
  });
});

export const cancelAuction = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const isAdmin = req.role === 'ADMIN';
  const id = (req.validated?.params?.id || req.params.id) as string;
  const { reason } = req.body || {};

  const auction = await auctionService.cancelAuction(userId, id, isAdmin, reason);

  return successResponse(res, {
    statusCode: 200,
    message: 'Auction cancelled and any active bids refunded',
    data: { auction },
  });
});
