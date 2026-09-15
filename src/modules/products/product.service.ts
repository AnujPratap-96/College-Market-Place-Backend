import { env } from '../../config/env';
import { productRepository, ProductRepository } from './product.repository';
import { ApiError } from '../../utils/api-error';
import { ProductType, SubscriptionFrequency } from '@prisma/client';
import { emitToUser } from '../../lib/socket';
import { campusVectorService } from '../assistant/campus-vector.service';
import { syncProductToAlgolia, deleteProductFromAlgolia } from '../../lib/algolia';
import prisma from '../../lib/prisma';
import { auctionService } from '../auctions/auction.service';

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
    images?: string[];
    securityDeposit?: number;
    rentalDuration?: string;
    frequency?: SubscriptionFrequency;
    deliverySlots?: string;
    serviceDuration?: string;
  }) {
    const hasProhibited =
      checkContainsProhibitedKeywords(data.title) ||
      checkContainsProhibitedKeywords(data.description);

    const images = Array.isArray(data.images) && data.images.length > 0
      ? data.images
      : data.imageUrl
        ? [data.imageUrl]
        : [];
    const imageUrl = data.imageUrl || images[0] || undefined;

    const product = await this.repo.create({
      ...data,
      imageUrl,
      images,
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
    syncProductToAlgolia(product);

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

    const payload = { ...data };

    const existingAuction = await prisma.auction.findUnique({
      where: { productId: id },
    });

    if (existingAuction) {
      if (existingAuction.status === 'ENDED' || existingAuction.status === 'CANCELLED') {
        throw new ApiError(400, 'Cannot edit an auction that has ended or been cancelled.');
      }
      delete payload.price;
      delete payload.type;
      delete payload.status;
      delete payload.securityDeposit;
      delete payload.rentalDuration;
      delete payload.frequency;
      delete payload.deliverySlots;
      delete payload.serviceDuration;
    }

    if (data.images !== undefined) {
      const images = Array.isArray(data.images) ? data.images : [];
      payload.images = images;
      if (!payload.imageUrl && images.length > 0) {
        payload.imageUrl = images[0];
      }
    }

    const updated = await this.repo.update(id, { ...payload, isFlagged });
    campusVectorService.upsertProduct(updated).catch(() => {});
    syncProductToAlgolia(updated);
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

    const existingAuction = await prisma.auction.findUnique({
      where: { productId: id },
    });
    if (existingAuction && existingAuction.status !== 'ENDED' && existingAuction.status !== 'CANCELLED') {
      await auctionService.cancelAuction(userId, existingAuction.id, true, 'Product deleted by owner');
    }

    const deleted = await this.repo.delete(id);
    campusVectorService.removeProduct(id);
    deleteProductFromAlgolia(id);
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

  async aiEstimateListing(imageUrl: string, textHint?: string) {
    if (!imageUrl) {
      throw new ApiError(400, 'Image URL is required for AI visual estimation.');
    }

    const apiKey = env.MISTRAL_API_KEY;
    let aiResult: any = null;

    if (apiKey) {
      try {
        const promptText = `Analyze this item for an Indian college campus student marketplace listing. ${textHint ? `User notes: "${textHint}". ` : ''}Provide realistic student-budget resale valuation in Indian Rupees (₹ INR). Also check for safety (no NSFW, weapons, or scam links). Return pure JSON strictly with keys:
"isSafe": boolean (true if the item is safe and appropriate for a college campus, false if it contains NSFW, weapons, scams, or illegal items),
"moderationReason": string (if isSafe is false, explain why. if true, leave empty),
"title": concise string under 50 chars,
"category": exactly one of ["books", "stationery", "electronics", "cycles", "clothing", "essentials", "furniture", "food", "services", "other"],
"condition": one of ["NEW", "LIKE_NEW", "GOOD", "FAIR"],
"suggestedPrice": number (integer in INR),
"priceMin": number (integer in INR),
"priceMax": number (integer in INR),
"description": string (2-3 sentences highlighting condition, specs, and utility for students),
"tags": array of 3-5 strings.`;

        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'pixtral-12b-2409',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: promptText },
                  { type: 'image_url', image_url: imageUrl },
                ],
              },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
            max_tokens: 500,
          }),
        });

        if (response.ok) {
          const data: any = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            aiResult = typeof content === 'string' ? JSON.parse(content) : content;
          }
        }
      } catch {}
    }

    if (!aiResult || !aiResult.title) {
      const lower = `${imageUrl} ${textHint || ''}`.toLowerCase();
      let category = 'other';
      let title = 'Campus Item';
      let price = 500;
      let min = 300;
      let max = 800;

      if (lower.includes('book') || lower.includes('edition') || lower.includes('author') || lower.includes('paperback') || lower.includes('hardcover')) {
        category = 'books';
        title = 'Academic Textbook / Reference Book';
        price = 350;
        min = 200;
        max = 500;
      } else if (lower.includes('cycle') || lower.includes('bike') || lower.includes('hercules') || lower.includes('hero') || lower.includes('gear')) {
        category = 'cycles';
        title = 'Campus Commuter Bicycle';
        price = 2200;
        min = 1500;
        max = 3000;
      } else if (lower.includes('laptop') || lower.includes('headphone') || lower.includes('earphone') || lower.includes('mouse') || lower.includes('keyboard') || lower.includes('phone') || lower.includes('charger') || lower.includes('monitor') || lower.includes('tech')) {
        category = 'electronics';
        title = 'Electronic Accessory / Device';
        price = 1200;
        min = 700;
        max = 2000;
      } else if (lower.includes('table') || lower.includes('chair') || lower.includes('desk') || lower.includes('mattress') || lower.includes('bed')) {
        category = 'furniture';
        title = 'Hostel Furniture / Study Setup';
        price = 800;
        min = 500;
        max = 1400;
      } else if (lower.includes('kettle') || lower.includes('iron') || lower.includes('lamp') || lower.includes('bottle') || lower.includes('cooler') || lower.includes('fan') || lower.includes('bucket')) {
        category = 'essentials';
        title = 'Hostel Room Essential Appliance';
        price = 650;
        min = 400;
        max = 1000;
      } else if (lower.includes('calculator') || lower.includes('drafter') || lower.includes('notes') || lower.includes('pen') || lower.includes('kit')) {
        category = 'stationery';
        title = 'Engineering / Lab Stationery Kit';
        price = 300;
        min = 150;
        max = 450;
      }

      aiResult = {
        title,
        category,
        condition: 'GOOD',
        suggestedPrice: price,
        priceMin: min,
        priceMax: max,
        description: `Well-maintained ${title.toLowerCase()} in great working condition. Ideal for campus students looking for a reliable deal.`,
        tags: [category, 'campus', 'verified'],
      };
    }

    const price = Number(aiResult.suggestedPrice) || 500;
    const priceMin = Number(aiResult.priceMin) || Math.round(price * 0.75);
    const priceMax = Number(aiResult.priceMax) || Math.round(price * 1.3);

    return {
      title: String(aiResult.title).slice(0, 100),
      category: String(aiResult.category).toLowerCase(),
      condition: String(aiResult.condition || 'GOOD'),
      suggestedPrice: price,
      priceRange: {
        min: priceMin,
        max: priceMax,
      },
      description: String(aiResult.description || ''),
      tags: Array.isArray(aiResult.tags) ? aiResult.tags.slice(0, 5) : [],
    };
  }
}

export const productService = new ProductService();
