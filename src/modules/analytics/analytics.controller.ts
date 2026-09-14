import { Request, Response } from 'express';
import { AnalyticsService } from './analytics.service';
import { successResponse } from '../../utils/response';
import { ApiError } from '../../utils/api-error';

const analyticsService = new AnalyticsService();

export class AnalyticsController {
  async getSellerAnalytics(req: Request, res: Response) {
    const userId = req.userId;
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const data = await analyticsService.getSellerAnalytics(userId);
    return successResponse(res, {
      statusCode: 200,
      message: 'Seller analytics retrieved successfully',
      data,
    });
  }
}
