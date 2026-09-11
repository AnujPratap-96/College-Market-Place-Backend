import { Router } from 'express';
import {
  getDashboardStats,
  getAllUsers,
  getAllProducts,
  getAllTransactions,
  deleteUser,
  toggleUserVerification,
  deleteProduct,
  createAdmin,
  getReports,
  handleReportAction,
  getDisputes,
  resolveDispute,
  getFinancialStats,
  getSystemSettings,
  updateSystemSettings,
  syncAssistantEmbeddings,
  getAssistantEmbeddingsStatus,
} from './admin.controller';
import { requireAuth } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  adminPaginationSchema,
  adminIdParamSchema,
  createAdminSchema,
  adminReportActionSchema,
  adminDisputeActionSchema,
  adminUpdateSettingsSchema,
} from './admin.schema';

const router = Router();

router.get('/dashboard', requireAuth, getDashboardStats);
router.get('/users', requireAuth, validate(adminPaginationSchema), getAllUsers);
router.get('/products', requireAuth, validate(adminPaginationSchema), getAllProducts);
router.get('/transactions', requireAuth, validate(adminPaginationSchema), getAllTransactions);
router.post('/user', requireAuth, validate(createAdminSchema), createAdmin);
router.patch('/users/:id/verify', requireAuth, validate(adminIdParamSchema), toggleUserVerification);
router.delete('/users/:id', requireAuth, validate(adminIdParamSchema), deleteUser);
router.delete('/products/:id', requireAuth, validate(adminIdParamSchema), deleteProduct);

router.get('/reports', requireAuth, validate(adminPaginationSchema), getReports);
router.post('/reports/:id/action', requireAuth, validate(adminReportActionSchema), handleReportAction);

router.get('/disputes', requireAuth, validate(adminPaginationSchema), getDisputes);
router.post('/disputes/:id/resolve', requireAuth, validate(adminDisputeActionSchema), resolveDispute);

router.get('/stats/financial', requireAuth, getFinancialStats);
router.get('/settings', requireAuth, getSystemSettings);
router.patch('/settings', requireAuth, validate(adminUpdateSettingsSchema), updateSystemSettings);

router.post('/assistant/sync-embeddings', requireAuth, syncAssistantEmbeddings);
router.get('/assistant/embeddings-status', requireAuth, getAssistantEmbeddingsStatus);

export default router;
