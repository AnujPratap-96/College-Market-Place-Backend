import prisma from '../../lib/prisma';
import { Product, ProductStatus, Prisma, ProductReport } from '@prisma/client';

export class ProductRepository {
  async findAllAvailable(): Promise<any[]> {
    return prisma.product.findMany({
      where: { status: 'AVAILABLE', isFlagged: false },
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
    });
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

  async findByOwner(ownerId: string): Promise<Product[]> {
    return prisma.product.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
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
