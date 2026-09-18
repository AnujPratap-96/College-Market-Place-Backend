import { z } from 'zod';
import { requestSchema } from '../../schemas/request.schema';

export const createHolidaySchema = requestSchema({
  body: z.object({
    startDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid start date'),
    endDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid end date'),
    reason: z.string().optional(),
  }),
});

export const holidayIdParamSchema = requestSchema({
  params: z.object({
    id: z.string().min(1, 'Holiday ID is required'),
  }),
});

export const syncHolidaysSchema = requestSchema({
  body: z.object({
    dates: z.array(z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date format'))
  }),
});
