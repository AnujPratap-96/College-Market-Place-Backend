import { Request, Response } from 'express';
import { holidayService } from './holiday.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';

export const createHoliday = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { startDate, endDate, reason } = req.validated?.body || req.body;
  const holiday = await holidayService.createHoliday(userId, new Date(startDate), new Date(endDate), reason);
  return successResponse(res, { statusCode: 201, message: 'Holiday created', data: holiday });
});

export const getMyHolidays = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const holidays = await holidayService.getMyHolidays(userId);
  return successResponse(res, { statusCode: 200, message: 'Holidays retrieved', data: holidays });
});

export const deleteHoliday = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const id = (req.validated?.params?.id || req.params.id) as string;
  await holidayService.deleteHoliday(userId, id);
  return successResponse(res, { statusCode: 200, message: 'Holiday deleted' });
});

export const syncHolidays = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { dates } = req.validated?.body || req.body;
  const parsedDates = dates.map((d: string) => new Date(d));
  const holidays = await holidayService.syncHolidays(userId, parsedDates);
  return successResponse(res, { statusCode: 200, message: 'Holidays synced', data: holidays });
});
