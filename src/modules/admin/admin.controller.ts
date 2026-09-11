import { Request, Response } from 'express';
import { adminService } from './admin.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';

export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const data = await adminService.getDashboardStats(userId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Dashboard statistics retrieved successfully',
    data,
  });
});

export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const query = req.validated?.query || req.query;
  const page = parseInt(query.page as string) || 1;
  const limit = parseInt(query.limit as string) || 10;
  const search = query.search as string | undefined;

  const data = await adminService.getAllUsers(userId, page, limit, search);
  return successResponse(res, {
    statusCode: 200,
    message: 'Users retrieved successfully',
    data,
  });
});

export const getAllProducts = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const query = req.validated?.query || req.query;
  const page = parseInt(query.page as string) || 1;
  const limit = parseInt(query.limit as string) || 10;
  const search = query.search as string | undefined;

  const data = await adminService.getAllProducts(userId, page, limit, search);
  return successResponse(res, {
    statusCode: 200,
    message: 'Products retrieved successfully',
    data,
  });
});

export const getAllTransactions = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const query = req.validated?.query || req.query;
  const page = parseInt(query.page as string) || 1;
  const limit = parseInt(query.limit as string) || 10;

  const data = await adminService.getAllTransactions(userId, page, limit);
  return successResponse(res, {
    statusCode: 200,
    message: 'Transactions retrieved successfully',
    data,
  });
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const targetId = (req.validated?.params?.id || req.params.id) as string;
  await adminService.deleteUser(userId, targetId);
  return successResponse(res, {
    statusCode: 200,
    message: 'User deleted successfully',
    data: null,
  });
});

export const toggleUserVerification = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const targetId = (req.validated?.params?.id || req.params.id) as string;
  const updatedUser = await adminService.toggleUserVerification(userId, targetId);
  return successResponse(res, {
    statusCode: 200,
    message: `User ${updatedUser.isVerified ? 'verified' : 'unverified'} successfully`,
    data: { user: updatedUser },
  });
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const targetId = (req.validated?.params?.id || req.params.id) as string;
  await adminService.deleteProduct(userId, targetId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Product deleted successfully',
    data: null,
  });
});

export const createAdmin = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const adminData = req.validated?.body || req.body;
  const admin = await adminService.createAdmin(userId, adminData);
  const { password, ...safeAdmin } = admin;
  return successResponse(res, {
    statusCode: 201,
    message: 'Admin created successfully',
    data: { user: safeAdmin },
  });
});

export const getReports = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const query = req.validated?.query || req.query;
  const page = parseInt(query.page as string) || 1;
  const limit = parseInt(query.limit as string) || 10;
  const status = query.status as any;

  const data = await adminService.getReports(userId, page, limit, status);
  return successResponse(res, {
    statusCode: 200,
    message: 'Reports retrieved successfully',
    data,
  });
});

export const handleReportAction = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const reportId = (req.validated?.params?.id || req.params.id) as string;
  const { action, notes } = req.validated?.body || req.body;

  const result = await adminService.handleReportAction(userId, reportId, action, notes);
  return successResponse(res, {
    statusCode: 200,
    message: result.message,
    data: result,
  });
});

export const getDisputes = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const query = req.validated?.query || req.query;
  const page = parseInt(query.page as string) || 1;
  const limit = parseInt(query.limit as string) || 10;

  const data = await adminService.getDisputes(userId, page, limit);
  return successResponse(res, {
    statusCode: 200,
    message: 'Disputes retrieved successfully',
    data,
  });
});

export const resolveDispute = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const orderId = (req.validated?.params?.id || req.params.id) as string;
  const { action, resolutionNote } = req.validated?.body || req.body;

  const order = await adminService.resolveDispute(userId, orderId, action, resolutionNote);
  return successResponse(res, {
    statusCode: 200,
    message: `Dispute resolved successfully: ${action}`,
    data: { order },
  });
});

export const getFinancialStats = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const stats = await adminService.getFinancialStats(userId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Financial statistics retrieved successfully',
    data: stats,
  });
});

export const getSystemSettings = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const settings = await adminService.getSystemSettings(userId);
  return successResponse(res, {
    statusCode: 200,
    message: 'System settings retrieved successfully',
    data: { settings },
  });
});

export const updateSystemSettings = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const updates = req.validated?.body || req.body;
  const settings = await adminService.updateSystemSettings(userId, updates);
  return successResponse(res, {
    statusCode: 200,
    message: 'System settings updated successfully',
    data: { settings },
  });
});

export const syncAssistantEmbeddings = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const stats = await adminService.syncAssistantEmbeddings(userId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Assistant product vector embeddings synchronized successfully',
    data: stats,
  });
});

export const getAssistantEmbeddingsStatus = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const stats = await adminService.getAssistantEmbeddingsStatus(userId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Assistant product embeddings status retrieved successfully',
    data: stats,
  });
});
