import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export class HolidayRepository {
  async create(data: { userId: string; startDate: Date; endDate: Date; reason?: string }) {
    return prisma.holiday.create({ data });
  }

  async findByUser(userId: string) {
    return prisma.holiday.findMany({ where: { userId }, orderBy: { startDate: 'asc' } });
  }

  async delete(id: string, userId: string) {
    return prisma.holiday.deleteMany({ where: { id, userId } });
  }
}
export const holidayRepository = new HolidayRepository();
