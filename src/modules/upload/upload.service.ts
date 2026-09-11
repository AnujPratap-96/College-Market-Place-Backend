import path from 'path';
import fs from 'fs';
import { getSupabaseAdmin, getSupabaseBucket } from '../../lib/supabase';
import { ApiError } from '../../utils/api-error';

export class UploadService {
  async getSignedUploadUrl(
    userId: string,
    filename: string,
    fileType: string,
    folder: 'products' | 'avatars' = 'products'
  ) {
    const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'];
    if (!allowedMime.includes(fileType.toLowerCase())) {
      throw new ApiError(400, 'Invalid file type. Only JPEG, PNG, WebP, and AVIF are supported.');
    }

    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const cleanExt = ['jpeg', 'jpg', 'png', 'webp', 'avif'].includes(ext) ? ext : 'jpg';
    const storagePath = `${folder}/${userId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${cleanExt}`;
    const bucket = getSupabaseBucket();
    const supabase = getSupabaseAdmin();

    if (supabase) {
      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUploadUrl(storagePath);

        if (error) {
          throw new ApiError(502, `Supabase storage error: ${error.message}`);
        }

        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(storagePath);

        return {
          signedUrl: data.signedUrl,
          token: data.token,
          path: storagePath,
          publicUrl: publicData.publicUrl,
          provider: 'SUPABASE',
        };
      } catch (err: any) {
        if (err instanceof ApiError) throw err;
        throw new ApiError(502, `Storage connection failed: ${err.message}`);
      }
    }

    return {
      signedUrl: null,
      fallbackUrl: '/api/upload/direct',
      path: storagePath,
      publicUrl: `/uploads/${storagePath}`,
      provider: 'LOCAL',
    };
  }

  async saveDirectUpload(
    userId: string,
    file: { originalname: string; mimetype: string; buffer: Buffer; size: number },
    folder: 'products' | 'avatars' = 'products'
  ) {
    if (!file || !file.buffer) {
      throw new ApiError(400, 'No file provided for upload.');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new ApiError(400, 'File size exceeds maximum limit of 5MB.');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new ApiError(400, 'Only image files are permitted.');
    }

    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    const cleanExt = ['jpeg', 'jpg', 'png', 'webp', 'avif'].includes(ext) ? ext : 'jpg';
    const storagePath = `${folder}/${userId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${cleanExt}`;
    const bucket = getSupabaseBucket();
    const supabase = getSupabaseAdmin();

    if (supabase) {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (error) {
        throw new ApiError(502, `Supabase storage upload failed: ${error.message}`);
      }

      const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
      return {
        publicUrl: publicData.publicUrl,
        path: storagePath,
        provider: 'SUPABASE',
      };
    }

    const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads', folder, userId);
    await fs.promises.mkdir(uploadsDir, { recursive: true });
    const localFilePath = path.join(uploadsDir, path.basename(storagePath));
    await fs.promises.writeFile(localFilePath, file.buffer);

    return {
      publicUrl: `/uploads/${folder}/${userId}/${path.basename(storagePath)}`,
      path: storagePath,
      provider: 'LOCAL',
    };
  }
}

export const uploadService = new UploadService();
