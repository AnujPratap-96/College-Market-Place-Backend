import { logger } from '../utils/logger';
import { env } from '../config/env';
import { algoliasearch } from 'algoliasearch';

const appId = env.ALGOLIA_APPLICATION_ID;
const apiKey = env.ALGOLIA_ADMIN_API_KEY;

export const algoliaClient = (appId && apiKey) ? algoliasearch(appId, apiKey) : null;
export const PRODUCT_INDEX = 'college_marketplace_products';

if (!algoliaClient) {
  logger.warn('[Algolia] Missing credentials. Search sync is disabled.');
}

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const initAlgoliaIndexSettings = async () => {
  if (!algoliaClient) return;
  try {
    await algoliaClient.setSettings({
      indexName: PRODUCT_INDEX,
      indexSettings: {
        attributesForFaceting: [
          'category',
          'type',
          'price',
        ],
      },
    });
    logger.info('[Algolia] Index faceting settings configured successfully.');
  } catch (error) {
    logger.error('[Algolia] Failed to set index settings:', error);
  }
};

// Auto-run settings on module load
initAlgoliaIndexSettings();

export const syncProductToAlgolia = async (product: any) => {
  if (!algoliaClient) return;
  try {
    // Ensure we have owner data
    let productToSync = product;
    if (!productToSync.owner) {
      const fullProduct = await prisma.product.findUnique({
        where: { id: product.id },
        include: { owner: true }
      });
      if (fullProduct) productToSync = fullProduct;
    }

    const algoliaObject = {
      ...productToSync,
      category: productToSync.category ? productToSync.category.toLowerCase() : productToSync.category,
      objectID: productToSync.id,
    };
    await algoliaClient.saveObject({
      indexName: PRODUCT_INDEX,
      body: algoliaObject,
    });
  } catch (error) {
    logger.error('[Algolia] Failed to sync product:', error);
  }
};

export const deleteProductFromAlgolia = async (productId: string) => {
  if (!algoliaClient) return;
  try {
    await algoliaClient.deleteObject({
      indexName: PRODUCT_INDEX,
      objectID: productId,
    });
  } catch (error) {
    logger.error('[Algolia] Failed to delete product from Algolia:', error);
  }
};
