import { logger } from '../utils/logger';
import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
import { syncProductToAlgolia } from '../lib/algolia';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: { status: 'AVAILABLE' },
    include: { owner: true }
  });

  for (const product of products) {
    await syncProductToAlgolia(product);
  }
  logger.info('✅ Re-synced with owner data!');
  process.exit(0);
}
main();
