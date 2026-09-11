import { Router } from 'express';
import {
  createAuction,
  getAuctions,
  getAuctionById,
  placeBid,
  settleAuction,
} from './auction.controller';
import { requireAuth } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createAuctionSchema,
  auctionIdParamSchema,
  placeBidSchema,
} from './auction.schema';

const router = Router();

router.post('/', requireAuth, validate(createAuctionSchema), createAuction);
router.get('/', getAuctions);
router.get('/:id', validate(auctionIdParamSchema), getAuctionById);
router.post('/:id/bid', requireAuth, validate(placeBidSchema), placeBid);
router.post('/:id/settle', requireAuth, validate(auctionIdParamSchema), settleAuction);

export default router;
