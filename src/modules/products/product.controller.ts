import { Request, Response } from 'express';
import { productService } from './product.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';

export const getAllProducts = asyncHandler(async (_req: Request, res: Response) => {
  const products = await productService.getAllAvailable();
  return successResponse(res, {
    statusCode: 200,
    message: 'Products retrieved successfully',
    data: { products },
  });
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const id = (req.validated?.params?.id || req.params.id) as string;
  const product = await productService.getProductById(id);
  return successResponse(res, {
    statusCode: 200,
    message: 'Product retrieved successfully',
    data: { product },
  });
});

export const getFilteredProducts = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validated?.query || req.query;
  const products = await productService.getFilteredProducts({
    q: query.q as string,
    category: query.category as string,
    type: query.type as string,
  });
  return successResponse(res, {
    statusCode: 200,
    message: 'Filtered products retrieved successfully',
    data: { products },
  });
});

export const getMyProducts = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const products = await productService.getMyProducts(userId);
  return successResponse(res, {
    statusCode: 200,
    message: 'My products retrieved successfully',
    data: { products },
  });
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const productData = req.validated?.body || req.body;
  const product = await productService.createProduct(userId, productData);
  return successResponse(res, {
    statusCode: 201,
    message: 'Product created successfully',
    data: { product },
  });
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const id = (req.validated?.params?.id || req.params.id) as string;
  const updateData = req.validated?.body || req.body;
  const product = await productService.updateProduct(id, userId, updateData);
  return successResponse(res, {
    statusCode: 200,
    message: 'Product updated successfully',
    data: { product },
  });
});

export const markProductSold = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const id = (req.validated?.params?.id || req.params.id) as string;
  const product = await productService.markProductSold(id, userId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Product marked as sold',
    data: { product },
  });
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const id = (req.validated?.params?.id || req.params.id) as string;
  await productService.deleteProduct(id, userId);
  return successResponse(res, {
    statusCode: 200,
    message: 'Product deleted successfully',
    data: null,
  });
});

export const reportProduct = asyncHandler(async (req: Request, res: Response) => {
  const reporterId = req.userId!;
  const productId = (req.validated?.params?.id || req.params.id) as string;
  const { reason, details } = req.validated?.body || req.body;
  const report = await productService.reportProduct(reporterId, productId, reason, details);
  return successResponse(res, {
    statusCode: 201,
    message: 'Report submitted successfully and queued for administrative review',
    data: { report },
  });
});

export const estimateProductListing = asyncHandler(async (req: Request, res: Response) => {
  const { imageUrl, textHint } = req.body;
  const estimate = await productService.aiEstimateListing(imageUrl, textHint);
  return successResponse(res, {
    statusCode: 200,
    message: 'AI listing estimation generated successfully',
    data: estimate,
  });
});
