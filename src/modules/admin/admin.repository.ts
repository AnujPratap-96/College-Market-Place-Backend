import prisma from '../../lib/prisma';
import { ReportStatus, OrderStatus, Prisma } from '@prisma/client';

export class AdminRepository {
  async getStats() {
    const totalUsers = await prisma.user.count();
    const verifiedUsers = await prisma.user.count({ where: { isVerified: true } });
    const totalProducts = await prisma.product.count();
    const availableProducts = await prisma.product.count({ where: { status: 'AVAILABLE' } });
    const soldProducts = await prisma.product.count({ where: { status: 'SOLD' } });
    const totalRequests = await prisma.request.count();
    const completedRequests = await prisma.request.count({ where: { status: 'COMPLETED' } });
    const totalTransactions = await prisma.transaction.count();

    const sellCount = await prisma.product.count({ where: { type: 'SELL' } });
    const rentCount = await prisma.product.count({ where: { type: 'RENT' } });

    const recentUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, college: true, role: true, createdAt: true },
    });

    const recentTransactions = await prisma.transaction.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        request: {
          select: {
            id: true,
            totalAmount: true,
            buyer: { select: { name: true } },
            seller: { select: { name: true } },
          },
        },
      },
    });

    return {
      stats: {
        totalUsers,
        verifiedUsers,
        totalProducts,
        availableProducts,
        soldProducts,
        totalRequests,
        completedRequests,
        totalTransactions,
        sellCount,
        rentCount,
      },
      recentUsers,
      recentTransactions,
    };
  }

  async getAllUsers(page: number, limit: number, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { college: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          college: true,
          branch: true,
          year: true,
          role: true,
          isVerified: true,
          createdAt: true,
          _count: { select: { products: true, requestsMade: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getAllProducts(page: number, limit: number, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: {
          owner: { select: { id: true, name: true, college: true } },
          _count: { select: { requests: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    return { products, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getAllTransactions(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        skip,
        take: limit,
        include: {
          request: {
            include: {
              buyer: { select: { id: true, name: true, email: true } },
              seller: { select: { id: true, name: true, email: true } },
              product: { select: { id: true, title: true, price: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.count(),
    ]);

    return { transactions, total, page, totalPages: Math.ceil(total / limit) };
  }

  async deleteUser(userId: string) {
    return prisma.user.delete({ where: { id: userId } });
  }

  async toggleVerification(userId: string, isVerified: boolean) {
    return prisma.user.update({
      where: { id: userId },
      data: { isVerified },
    });
  }

  async deleteProduct(productId: string) {
    return prisma.product.delete({ where: { id: productId } });
  }

  async createAdmin(data: any) {
    return prisma.user.create({ data });
  }

  async getReports(page: number, limit: number, status?: ReportStatus) {
    const skip = (page - 1) * limit;
    const where: Prisma.ProductReportWhereInput = status ? { status } : {};

    const [reports, total] = await Promise.all([
      prisma.productReport.findMany({
        where,
        skip,
        take: limit,
        include: {
          reporter: {
            select: { id: true, name: true, email: true, college: true },
          },
          product: {
            include: {
              owner: {
                select: { id: true, name: true, email: true, phone: true, college: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.productReport.count({ where }),
    ]);

    return { reports, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getReportById(id: string) {
    return prisma.productReport.findUnique({
      where: { id },
      include: {
        reporter: {
          select: { id: true, name: true, email: true, college: true },
        },
        product: {
          include: {
            owner: {
              select: { id: true, name: true, email: true, phone: true, college: true },
            },
          },
        },
      },
    });
  }

  async updateReportStatus(id: string, status: ReportStatus) {
    return prisma.productReport.update({
      where: { id },
      data: { status },
    });
  }

  async updateProductFlag(productId: string, isFlagged: boolean) {
    return prisma.product.update({
      where: { id: productId },
      data: { isFlagged },
    });
  }

  async getDisputedOrders(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where: Prisma.OrderWhereInput = { status: OrderStatus.DISPUTED };

    const [disputes, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          product: true,
          buyer: {
            select: { id: true, name: true, email: true, phone: true, college: true },
          },
          seller: {
            select: { id: true, name: true, email: true, phone: true, college: true },
          },
        },
        orderBy: { disputedAt: 'desc' },
      }),
      prisma.order.count({ where }),
    ]);

    return { disputes, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getOrderById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        product: true,
        buyer: true,
        seller: true,
      },
    });
  }

  async getFinancialStats() {
    const [
      completedOrdersAgg,
      disputesCount,
      completedOrdersCount,
      activeSubsCount,
      walletsAgg,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: { status: OrderStatus.COMPLETED },
        _sum: { totalAmount: true, platformFee: true },
      }),
      prisma.order.count({
        where: { status: OrderStatus.DISPUTED },
      }),
      prisma.order.count({
        where: { status: OrderStatus.COMPLETED },
      }),
      prisma.subscription.count({
        where: { status: 'ACTIVE' },
      }),
      prisma.wallet.aggregate({
        _sum: { escrowBalance: true, balance: true },
      }),
    ]);

    const totalVolume = completedOrdersAgg._sum.totalAmount || 0;
    const totalPlatformFee = completedOrdersAgg._sum.platformFee || 0;
    const totalEscrowHeld = walletsAgg._sum.escrowBalance || 0;
    const totalUserBalances = walletsAgg._sum.balance || 0;

    return {
      totalVolume,
      totalPlatformFee,
      totalEscrowHeld,
      totalUserBalances,
      completedOrdersCount,
      activeSubscriptionsCount: activeSubsCount,
      activeDisputesCount: disputesCount,
    };
  }
}

export const adminRepository = new AdminRepository();
