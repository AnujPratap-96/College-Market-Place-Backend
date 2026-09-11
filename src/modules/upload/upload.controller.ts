import { Request, Response } from 'express';
import { uploadService } from './upload.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';
import { ApiError } from '../../utils/api-error';

export const requestSignedUrl = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { filename, fileType, folder } = req.validated?.body || req.body;
  const result = await uploadService.getSignedUploadUrl(userId, filename, fileType, folder);
  return successResponse(res, {
    statusCode: 200,
    message: 'Upload authorization generated successfully',
    data: result,
  });
});

export const directUpload = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const file = (req as any).file;
  if (!file) {
    throw new ApiError(400, 'No file uploaded in form data.');
  }
  const folder = (req.body.folder === 'avatars' ? 'avatars' : 'products') as 'products' | 'avatars';
  const result = await uploadService.saveDirectUpload(userId, file as any, folder);
  return successResponse(res, {
    statusCode: 201,
    message: 'File uploaded successfully',
    data: result,
  });
});
