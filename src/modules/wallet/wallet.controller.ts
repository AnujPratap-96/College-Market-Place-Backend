import { Request, Response } from 'express';
import { walletService } from './wallet.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';
import { LedgerType } from '@prisma/client';

export const getWallet = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const wallet = await walletService.getWallet(userId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Wallet balance retrieved successfully',
    data: {
      ...wallet,
      wallet,
    },
  });
});

export const topup = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { amount } = req.validated?.body || req.body;
  const result = await walletService.topup(userId, amount);
  return successResponse(res, {
    statusCode: 200,
    message: `₹${amount} added to your wallet successfully`,
    data: result,
  });
});

export const transfer = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { recipient, amount, note } = req.validated?.body || req.body;
  const result = await walletService.transfer(userId, recipient, amount, note);
  return successResponse(res, {
    statusCode: 200,
    message: `₹${amount} transferred successfully to ${result.recipient.name}`,
    data: result,
  });
});

export const getHistory = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const query = req.validated?.query || req.query;
  const page = parseInt(query.page as string) || 1;
  const limit = parseInt(query.limit as string) || 15;
  const type = query.type as LedgerType | undefined;

  const history = await walletService.getHistory(userId, { page, limit, type });
  return successResponse(res, {
    statusCode: 200,
    message: 'Wallet transaction history retrieved successfully',
    data: {
      ...history,
      ledger: history.entries,
    },
  });
});

export const getStats = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const stats = await walletService.getStats(userId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Wallet monthly statistics retrieved successfully',
    data: stats,
  });
});

export const withdraw = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { upiId, amount } = req.validated?.body || req.body;
  const result = await walletService.withdraw(userId, upiId, amount);
  return successResponse(res, {
    statusCode: 200,
    message: `₹${amount} withdrawn to UPI successfully`,
    data: result,
  });
});

export const createPaymentOrder = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { amount } = req.validated?.body || req.body;
  const result = await walletService.createPaymentOrder(userId, amount);
  return successResponse(res, {
    statusCode: 200,
    message: 'Payment order created successfully',
    data: result,
  });
});

export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, amount } = req.validated?.body || req.body;
  const result = await walletService.verifyPayment(
    userId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    amount
  );
  return successResponse(res, {
    statusCode: 200,
    message: `Payment verified and ₹${amount} credited to your wallet`,
    data: result,
  });
});
