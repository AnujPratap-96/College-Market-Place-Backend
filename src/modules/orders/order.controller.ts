import { Request, Response } from 'express';
import { orderService } from './order.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';

export const checkout = asyncHandler(async (req: Request, res: Response) => {
  const buyerId = req.userId!;
  const { productId, paymentMethod, rentalDays, securityDeposit } = req.validated?.body || req.body;
  const order = await orderService.checkout(buyerId, productId, paymentMethod, rentalDays, securityDeposit);

  return successResponse(res, {
    statusCode: 201,
    message: order.orderType === 'RENTAL'
      ? 'Rental order created and funds (rental fee + security deposit) held in escrow'
      : 'Order created and payment held securely in escrow',
    data: { order },
  });
});

export const verifyHandover = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = req.userId!;
  const id = (req.validated?.params?.id || req.params.id) as string;
  const { pickupOtp } = req.validated?.body || req.body;
  const order = await orderService.verifyHandoverWithOtp(sellerId, id, pickupOtp);

  return successResponse(res, {
    statusCode: 200,
    message: order.orderType === 'RENTAL'
      ? 'Pickup verified! Rental fee released to your wallet. Rental is now active.'
      : 'Delivery verified successfully! Funds released to your wallet.',
    data: { order },
  });
});

export const verifyReturn = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = req.userId!;
  const id = (req.validated?.params?.id || req.params.id) as string;
  const { returnOtp } = req.validated?.body || req.body;
  const order = await orderService.verifyReturnWithOtp(sellerId, id, returnOtp);

  return successResponse(res, {
    statusCode: 200,
    message: 'Return verified successfully! Security deposit refunded to buyer and item is now available.',
    data: { order },
  });
});

export const confirmReceived = asyncHandler(async (req: Request, res: Response) => {
  const buyerId = req.userId!;
  const id = (req.validated?.params?.id || req.params.id) as string;
  const order = await orderService.confirmReceived(buyerId, id);

  return successResponse(res, {
    statusCode: 200,
    message: 'Receipt confirmed! Payment released to seller.',
    data: { order },
  });
});

export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const id = (req.validated?.params?.id || req.params.id) as string;
  const order = await orderService.cancelOrder(userId, id);

  return successResponse(res, {
    statusCode: 200,
    message: 'Order cancelled successfully and held funds refunded',
    data: { order },
  });
});

export const getMyOrders = asyncHandler(async (req: Request, res: Response) => {
  const buyerId = req.userId!;
  const orders = await orderService.getMyOrders(buyerId);

  return successResponse(res, {
    statusCode: 200,
    message: 'Purchase orders retrieved successfully',
    data: { orders },
  });
});

export const getMySales = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = req.userId!;
  const sales = await orderService.getMySales(sellerId);

  return successResponse(res, {
    statusCode: 200,
    message: 'Sales orders retrieved successfully',
    data: { sales },
  });
});

export const getOrderById = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const id = (req.validated?.params?.id || req.params.id) as string;
  const order = await orderService.getOrderById(userId, id);

  return successResponse(res, {
    statusCode: 200,
    message: 'Order details retrieved successfully',
    data: { order },
  });
});

export const raiseDispute = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const id = (req.validated?.params?.id || req.params.id) as string;
  const { reason } = req.validated?.body || req.body;
  const order = await orderService.raiseDispute(userId, id, reason);

  return successResponse(res, {
    statusCode: 200,
    message: 'Dispute filed successfully and escalated for administrative review',
    data: { order },
  });
});

export const bookService = asyncHandler(async (req: Request, res: Response) => {
  const buyerId = req.userId!;
  const { productId, preferredTime, notes } = req.validated?.body || req.body;
  const order = await orderService.bookService(buyerId, productId, preferredTime, notes);

  return successResponse(res, {
    statusCode: 201,
    message: 'Service booked successfully and payment held securely in escrow',
    data: { order },
  });
});

export const completeService = asyncHandler(async (req: Request, res: Response) => {
  const providerId = req.userId!;
  const id = (req.validated?.params?.id || req.params.id) as string;
  const order = await orderService.completeService(providerId, id);

  return successResponse(res, {
    statusCode: 200,
    message: 'Service marked as completed. Awaiting client confirmation to release payment.',
    data: { order },
  });
});

export const confirmService = asyncHandler(async (req: Request, res: Response) => {
  const buyerId = req.userId!;
  const id = (req.validated?.params?.id || req.params.id) as string;
  const order = await orderService.confirmService(buyerId, id);

  return successResponse(res, {
    statusCode: 200,
    message: 'Service confirmed! Payment released to provider.',
    data: { order },
  });
});
