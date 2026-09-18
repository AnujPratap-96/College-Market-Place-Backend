import { holidayRepository } from './holiday.repository';
import prisma from '../../lib/prisma';
import { ApiError } from '../../utils/api-error';

export class HolidayService {
  async createHoliday(userId: string, startDate: Date, endDate: Date, reason?: string) {
    if (startDate > endDate) throw new ApiError(400, 'Start date must be before end date');
    return holidayRepository.create({ userId, startDate, endDate, reason });
  }

  async getMyHolidays(userId: string) {
    return holidayRepository.findByUser(userId);
  }

  async deleteHoliday(userId: string, id: string) {
    const deleted = await holidayRepository.delete(id, userId);
    if (deleted.count === 0) throw new ApiError(404, 'Holiday not found or unauthorized');
    return true;
}

  async syncHolidays(userId: string, dates: Date[]) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Delete all future/current single-day holidays
    await prisma.holiday.deleteMany({
      where: {
        userId,
        startDate: { gte: today }
      }
    });

    const newHolidays = dates.map(d => ({
      userId,
      startDate: d,
      endDate: d,
      reason: 'Calendar sync'
    }));
    
    if (newHolidays.length > 0) {
      await prisma.holiday.createMany({ data: newHolidays });
    }
    
    return this.getMyHolidays(userId);
  }
}
export const holidayService = new HolidayService();

  