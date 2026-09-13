import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma';

const main = async () => {
  const totalProducts = await prisma.product.count();
  const activeProducts = await prisma.product.count({
    where: { status: { in: ['AVAILABLE', 'RENTED'] } },
  });
  const productsByStatus = await prisma.product.groupBy({
    by: ['status'],
    _count: { _all: true },
  });

  let dbEmbeddingStats:
    | { count: number; activeWithEmbedding: number; lastUpdatedAt: Date | null }
    | { error: string };

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ count: number; max_updated_at: Date | null }>>(
      'SELECT COUNT(*)::int AS count, MAX(updated_at) AS max_updated_at FROM product_embeddings'
    );
    const activeRows = await prisma.$queryRawUnsafe<Array<{ active_with_embedding: number }>>(
      `SELECT COUNT(*)::int AS active_with_embedding
       FROM product_embeddings pe
       JOIN "Product" p ON p.id = pe.product_id
       WHERE p.status IN ('AVAILABLE', 'RENTED')`
    );

    dbEmbeddingStats = {
      count: rows[0]?.count ?? 0,
      activeWithEmbedding: activeRows[0]?.active_with_embedding ?? 0,
      lastUpdatedAt: rows[0]?.max_updated_at ?? null,
    };
  } catch (error) {
    dbEmbeddingStats = {
      error: error instanceof Error ? error.message : 'Unable to query product_embeddings',
    };
  }

  const cachePath = path.resolve(process.cwd(), 'src', 'data', 'campus-product-vectors.json');
  let localCacheStats:
    | { count: number; lastSyncedAt: string | null; embeddingDimensions: number[] }
    | { error: string };

  try {
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    const items = Array.isArray(cache.items) ? cache.items : [];
    const embeddingDimensions = Array.from(
      new Set<number>(
        items.map((item: { embedding?: unknown[] }) =>
          Array.isArray(item.embedding) ? item.embedding.length : 0
        )
      )
    ).sort((a, b) => a - b);

    localCacheStats = {
      count: items.length,
      lastSyncedAt: cache.lastSyncedAt ?? null,
      embeddingDimensions,
    };
  } catch (error) {
    localCacheStats = {
      error: error instanceof Error ? error.message : 'Unable to read local vector cache',
    };
  }

  console.log(
    JSON.stringify(
      {
        totalProducts,
        activeProducts,
        productsByStatus: productsByStatus.map((row) => ({
          status: row.status,
          count: row._count._all,
        })),
        dbEmbeddingStats,
        localCacheStats,
      },
      null,
      2
    )
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
