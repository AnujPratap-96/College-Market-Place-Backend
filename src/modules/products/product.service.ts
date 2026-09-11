import { productRepository, ProductRepository } from './product.repository';
import { ApiError } from '../../utils/api-error';
import { ProductType } from '@prisma/client';
import { emitToUser } from '../../lib/socket';
import { campusVectorService } from '../assistant/campus-vector.service';

const PROHIBITED_KEYWORDS = [
  'weapon', 'gun', 'knife', 'explosive', 'drug', 'weed', 'cannabis',
  'leak paper', 'exam leak', 'hack', 'pirated', 'cheat code', 'fake id',
  'stolen', 'counterfeit', 'replica'
];

function checkContainsProhibitedKeywords(text?: string | null): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase();
  return PROHIBITED_KEYWORDS.some((kw) => normalized.includes(kw));
}

export class ProductService {
  constructor(private repo: ProductRepository = productRepository) {}

  async getAllAvailable() {
    return this.repo.findAllAvailable();
  }

  async getProductById(id: string) {
    const product = await this.repo.findById(id);
    if (!product) {
      throw new ApiError(404, 'Product not found.');
    }
    return product;
  }

  async getFilteredProducts(filters: { q?: string; category?: string; type?: string }) {
    const filterConditions: any = {
      status: 'AVAILABLE',
    };

    if (filters.q) {
      filterConditions.title = { contains: filters.q, mode: 'insensitive' };
    }

    if (filters.category && filters.category !== 'ALL') {
      filterConditions.category = filters.category;
    }

    if (filters.type && filters.type !== 'ALL') {
      filterConditions.type = filters.type as ProductType;
    }

    return this.repo.findFiltered(filterConditions);
  }

  async getMyProducts(ownerId: string) {
    return this.repo.findByOwner(ownerId);
  }

  async createProduct(ownerId: string, data: {
    title: string;
    description: string;
    price: number;
    type: ProductType;
    category: string;
    imageUrl?: string;
  }) {
    const hasProhibited =
      checkContainsProhibitedKeywords(data.title) ||
      checkContainsProhibitedKeywords(data.description);

    const product = await this.repo.create({
      ...data,
      isFlagged: hasProhibited,
      ownerId,
    });

    if (hasProhibited) {
      emitToUser(ownerId, 'product_moderation_alert', {
        productId: product.id,
        message: 'Your product contains restricted keywords and has been flagged for administrative review.',
      });
    }

    campusVectorService.upsertProduct(product).catch(() => {});

    return product;
  }

  async updateProduct(id: string, userId: string, data: any) {
    const product = await this.repo.findById(id);
    if (!product) {
      throw new ApiError(404, 'Product not found.');
    }

    if (product.ownerId !== userId) {
      throw new ApiError(403, 'Not authorized to update this product.');
    }

    let isFlagged = product.isFlagged;
    if (data.title || data.description) {
      const titleToCheck = data.title || product.title;
      const descToCheck = data.description || product.description;
      if (checkContainsProhibitedKeywords(titleToCheck) || checkContainsProhibitedKeywords(descToCheck)) {
        isFlagged = true;
      }
    }

    const updated = await this.repo.update(id, { ...data, isFlagged });
    campusVectorService.upsertProduct(updated).catch(() => {});
    return updated;
  }

  async markProductSold(id: string, userId: string) {
    const product = await this.repo.findById(id);
    if (!product) {
      throw new ApiError(404, 'Product not found.');
    }

    if (product.ownerId !== userId) {
      throw new ApiError(403, 'Not authorized to update this product.');
    }

    const updated = await this.repo.update(id, { status: 'SOLD' });
    campusVectorService.removeProduct(id);
    return updated;
  }

  async deleteProduct(id: string, userId: string) {
    const product = await this.repo.findById(id);
    if (!product) {
      throw new ApiError(404, 'Product not found.');
    }

    if (product.ownerId !== userId) {
      throw new ApiError(403, 'Not authorized to delete this product.');
    }

    const deleted = await this.repo.delete(id);
    campusVectorService.removeProduct(id);
    return deleted;
  }

  async reportProduct(reporterId: string, productId: string, reason: string, details?: string) {
    const product = await this.repo.findById(productId);
    if (!product) {
      throw new ApiError(404, 'Product not found.');
    }

    if (product.ownerId === reporterId) {
      throw new ApiError(400, 'You cannot report your own product.');
    }

    const existingReport = await this.repo.findReportByUser(productId, reporterId);
    if (existingReport) {
      throw new ApiError(400, 'You have already submitted a report for this product that is awaiting review.');
    }

    const report = await this.repo.createReport({
      productId,
      reporterId,
      reason,
      details,
    });

    const pendingCount = await this.repo.countReportsByProduct(productId);
    if (pendingCount >= 3 && !product.isFlagged) {
      await this.repo.setProductFlagged(productId, true);
      emitToUser(product.ownerId, 'product_moderation_alert', {
        productId,
        message: 'Your listing has received multiple reports and is hidden pending review.',
      });
    }

    return report;
  }
}

export const productService = new ProductService();
