import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createHolidaySchema, holidayIdParamSchema, syncHolidaysSchema } from './holiday.schema';
import { createHoliday, getMyHolidays, deleteHoliday, syncHolidays } from './holiday.controller';

const router = Router();
router.use(requireAuth);

router.post('/', validate(createHolidaySchema), createHoliday);
router.post('/sync', validate(syncHolidaysSchema), syncHolidays);
router.get('/', getMyHolidays);
router.delete('/:id', validate(holidayIdParamSchema), deleteHoliday);

export default router;
