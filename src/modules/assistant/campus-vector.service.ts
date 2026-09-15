import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import fs from 'fs';
import path from 'path';
import prisma from '../../lib/prisma';
import { ProductStatus } from '@prisma/client';

export interface VectorProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  type: string;
  category: string;
  status: string;
  imageUrl?: string | null;
  embedding: number[];
}

export interface VectorIndexStats {
  totalIndexed: number;
  availableCount: number;
  rentedCount: number;
  lastSyncedAt: string | null;
}

class CampusVectorService {
  private products: Map<string, VectorProduct> = new Map();
  private filePath = path.resolve(process.cwd(), 'src', 'data', 'campus-product-vectors.json');
  private readonly vectorDimension = 128;
  private lastSyncedAt: string | null = null;
  private isTableInitialized = false;

  constructor() {
    this.loadFromDisk();
    this.ensureDatabaseTable().catch(() => {});
  }

  private async ensureDatabaseTable(): Promise<void> {
    if (this.isTableInitialized) return;
    try {
      await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;');
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS product_embeddings (
          product_id TEXT PRIMARY KEY REFERENCES "Product"(id) ON DELETE CASCADE,
          embedding vector(1024),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS product_embeddings_vector_idx 
        ON product_embeddings 
        USING hnsw (embedding vector_cosine_ops);
      `);
      this.isTableInitialized = true;
    } catch (err) {
      logger.error('[CampusVectorService] ensureDatabaseTable failed:', err);
    }
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        const data = JSON.parse(content);
        if (Array.isArray(data.items)) {
          for (const item of data.items) {
            this.products.set(item.id, item);
          }
          this.lastSyncedAt = data.lastSyncedAt || null;
        }
      }
    } catch (err) {
      logger.error('[CampusVectorService] Failed to load cached vectors:', err);
    }
  }

  private saveToDisk(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        lastSyncedAt: this.lastSyncedAt || new Date().toISOString(),
        items: Array.from(this.products.values()),
      };
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      logger.error('[CampusVectorService] Failed to save vectors to disk:', err);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const apiKey = env.MISTRAL_API_KEY;
    if (apiKey) {
      try {
        const response = await fetch('https://api.mistral.ai/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'mistral-embed',
            input: [text],
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          if (data?.data?.[0]?.embedding) {
            return data.data[0].embedding;
          }
        }
      } catch (err) {
        logger.warn('[CampusVectorService] Mistral API call failed, using fallback:', err);
      }
    }

    return this.generateDeterministicVector(text);
  }

  private generateDeterministicVector(text: string): number[] {
    const vector = new Array(this.vectorDimension).fill(0);
    const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter(t => t.length > 1);

    if (tokens.length === 0) return vector;

    for (const token of tokens) {
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        hash = (hash << 5) - hash + token.charCodeAt(i);
        hash |= 0;
      }
      const index = Math.abs(hash) % this.vectorDimension;
      vector[index] += 1;
    }

    let norm = 0;
    for (let i = 0; i < this.vectorDimension; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < this.vectorDimension; i++) {
        vector[i] = vector[i] / norm;
      }
    }

    return vector;
  }

  async upsertProduct(product: {
    id: string;
    title: string;
    description: string;
    price: number;
    type: string;
    category: string;
    status: string;
    imageUrl?: string | null;
  }): Promise<void> {
    if (product.status === ProductStatus.SOLD) {
      this.removeProduct(product.id);
      return;
    }

    const textToEmbed = `${product.title}. ${product.description || ''} Category: ${product.category}. Price: ${product.price}. Type: ${product.type}. Status: ${product.status}`;
    const embedding = await this.generateEmbedding(textToEmbed);

    if (embedding.length === 1024) {
      try {
        await this.ensureDatabaseTable();
        const vectorStr = `[${embedding.join(',')}]`;
        await prisma.$executeRawUnsafe(
          `INSERT INTO product_embeddings (product_id, embedding, updated_at)
           VALUES ($1, $2::vector, NOW())
           ON CONFLICT (product_id)
           DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = NOW();`,
          product.id,
          vectorStr
        );
      } catch (err) {
        logger.error('[CampusVectorService] Failed to upsert vector in Postgres:', err);
      }
    }

    this.products.set(product.id, {
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      type: product.type,
      category: product.category,
      status: product.status,
      imageUrl: product.imageUrl,
      embedding,
    });

    this.saveToDisk();
  }

  removeProduct(productId: string): void {
    if (this.products.has(productId)) {
      this.products.delete(productId);
      this.saveToDisk();
    }
    prisma.$executeRawUnsafe(`DELETE FROM product_embeddings WHERE product_id = $1;`, productId).catch(() => {});
  }

  async searchSimilar(
    queryEmbedding: number[],
    topK = 6,
    minScore = 0.05
  ): Promise<Array<{ product: VectorProduct; score: number }>> {
    if (queryEmbedding.length === 1024) {
      try {
        await this.ensureDatabaseTable();
        const vectorStr = `[${queryEmbedding.join(',')}]`;
        const rows: any[] = await prisma.$queryRawUnsafe(
          `SELECT 
             p.id,
             p.title,
             p.description,
             p.price,
             p.type,
             p.category,
             p.status,
             p."imageUrl",
             1 - (pe.embedding <=> $1::vector) AS score
           FROM product_embeddings pe
           JOIN "Product" p ON p.id = pe.product_id
           WHERE p.status IN ('AVAILABLE', 'RENTED')
             AND 1 - (pe.embedding <=> $1::vector) >= $2
           ORDER BY pe.embedding <=> $1::vector
           LIMIT $3;`,
          vectorStr,
          minScore,
          topK
        );

        if (rows && rows.length > 0) {
          return rows.map(r => ({
            product: {
              id: r.id,
              title: r.title,
              description: r.description,
              price: Number(r.price),
              type: r.type,
              category: r.category,
              status: r.status,
              imageUrl: r.imageUrl,
              embedding: [],
            },
            score: Number(r.score),
          }));
        }
      } catch (err) {
        logger.error('[CampusVectorService] Supabase pgvector search fallback to local:', err);
      }
    }

    const list = Array.from(this.products.values());

    const activeList = list.filter(
      p => p.status === ProductStatus.AVAILABLE || p.status === ProductStatus.RENTED
    );

    const scored = activeList.map(product => {
      const score = this.cosineSimilarity(queryEmbedding, product.embedding);
      return { product, score };
    });

    return scored
      .filter(item => item.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async syncAllFromDatabase(): Promise<VectorIndexStats> {
    await this.ensureDatabaseTable();
    const products = await prisma.product.findMany({
      where: {
        status: {
          in: [ProductStatus.AVAILABLE, ProductStatus.RENTED],
        },
      },
    });

    this.products.clear();

    for (const p of products) {
      const textToEmbed = `${p.title}. ${p.description || ''} Category: ${p.category}. Price: ${p.price}. Type: ${p.type}. Status: ${p.status}`;
      const embedding = await this.generateEmbedding(textToEmbed);

      if (embedding.length === 1024) {
        try {
          const vectorStr = `[${embedding.join(',')}]`;
          await prisma.$executeRawUnsafe(
            `INSERT INTO product_embeddings (product_id, embedding, updated_at)
             VALUES ($1, $2::vector, NOW())
             ON CONFLICT (product_id)
             DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = NOW();`,
            p.id,
            vectorStr
          );
        } catch (err) {
          logger.error('[CampusVectorService] Sync pgvector insert failed for product', p.id, err);
        }
      }

      this.products.set(p.id, {
        id: p.id,
        title: p.title,
        description: p.description,
        price: p.price,
        type: p.type,
        category: p.category,
        status: p.status,
        imageUrl: p.imageUrl,
        embedding,
      });
    }

    this.lastSyncedAt = new Date().toISOString();
    this.saveToDisk();

    return this.getStats();
  }

  getStats(): VectorIndexStats {
    const all = Array.from(this.products.values());
    const availableCount = all.filter(p => p.status === ProductStatus.AVAILABLE).length;
    const rentedCount = all.filter(p => p.status === ProductStatus.RENTED).length;

    return {
      totalIndexed: all.length,
      availableCount,
      rentedCount,
      lastSyncedAt: this.lastSyncedAt,
    };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;
    return dot / denominator;
  }
}

export const campusVectorService = new CampusVectorService();
