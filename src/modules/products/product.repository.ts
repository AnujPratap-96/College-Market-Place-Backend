import prisma from '../../lib/prisma';
import { Product, ProductStatus, Prisma, ProductReport } from '@prisma/client';

export class ProductRepository {
  async findAllAvailable(options?: { page?: number; limit?: number }): Promise<{ products: any[]; pagination: { total: number; page: number; limit: number; totalPages: number; hasMore: boolean } }> {
    const page = options?.page && options.page > 0 ? options.page : 1;
    const limit = options?.limit && options.limit > 0 ? options.limit : 12;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = { status: 'AVAILABLE', isFlagged: false };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              college: true,
              branch: true,
              profileImage: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  async findById(id: string): Promise<any | null> {
    return prisma.product.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            college: true,
            branch: true,
            profileImage: true,
            phone: true,
          },
        },
        auction: true,
      },
    });
  }

  async findFiltered(filterConditions: Prisma.ProductWhereInput): Promise<any[]> {
    return prisma.product.findMany({
      where: {
        ...filterConditions,
        isFlagged: false,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            college: true,
            profileImage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByOwner(ownerId: string, options?: { page?: number; limit?: number }): Promise<{ products: Product[]; pagination: { total: number; page: number; limit: number; totalPages: number; hasMore: boolean } }> {
    const page = options?.page && options.page > 0 ? options.page : 1;
    const limit = options?.limit && options.limit > 0 ? options.limit : 12;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = { ownerId };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  async create(data: Prisma.ProductUncheckedCreateInput): Promise<Product> {
    return prisma.product.create({ data });
  }

  async update(id: string, data: Prisma.ProductUpdateInput): Promise<Product> {
    return prisma.product.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Product> {
    return prisma.product.delete({
      where: { id },
    });
  }

  async createReport(data: Prisma.ProductReportUncheckedCreateInput): Promise<ProductReport> {
    return prisma.productReport.create({ data });
  }

  async findReportByUser(productId: string, reporterId: string): Promise<ProductReport | null> {
    return prisma.productReport.findFirst({
      where: {
        productId,
        reporterId,
        status: 'PENDING',
      },
    });
  }

  async countReportsByProduct(productId: string): Promise<number> {
    return prisma.productReport.count({
      where: { productId, status: { in: ['PENDING', 'REVIEWED'] } },
    });
  }

  async setProductFlagged(id: string, isFlagged: boolean): Promise<Product> {
    return prisma.product.update({
      where: { id },
      data: { isFlagged },
    });
  }
}

export const productRepository = new ProductRepository();
