import prisma from '../../lib/prisma';
import { OrderStatus, ProductStatus } from '@prisma/client';

export class AnalyticsService {
  async getSellerAnalytics(userId: string) {
    const completedOrders = await prisma.order.findMany({
      where: {
        sellerId: userId,
        status: OrderStatus.COMPLETED,
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            category: true,
            price: true,
            imageUrl: true,
          },
        },
        buyer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const activeOrders = await prisma.order.findMany({
      where: {
        sellerId: userId,
        status: { in: [OrderStatus.ESCROW_HELD, OrderStatus.RENTAL_ACTIVE, OrderStatus.DELIVERED] },
      },
      select: {
        totalAmount: true,
      },
    });

    const totalListings = await prisma.product.count({
      where: { ownerId: userId },
    });

    const activeListings = await prisma.product.count({
      where: {
        ownerId: userId,
        status: ProductStatus.AVAILABLE,
      },
    });

    const grossEarnings = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalPlatformFees = completedOrders.reduce((sum, o) => sum + o.platformFee, 0);
    const netEarnings = Math.max(0, grossEarnings - totalPlatformFees);
    const inEscrowEarnings = activeOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalSalesCount = completedOrders.length;
    const averageOrderValue = totalSalesCount > 0 ? Number((grossEarnings / totalSalesCount).toFixed(2)) : 0;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyMap = new Map<string, { month: string; revenue: number; ordersCount: number }>();

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
      monthlyMap.set(key, { month: label, revenue: 0, ordersCount: 0 });
    }

    completedOrders.forEach((o) => {
      const d = new Date(o.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (monthlyMap.has(key)) {
        const item = monthlyMap.get(key)!;
        item.revenue += o.totalAmount - o.platformFee;
        item.ordersCount += 1;
      }
    });

    const monthlyEarnings = Array.from(monthlyMap.values()).map((m) => ({
      ...m,
      revenue: Number(m.revenue.toFixed(2)),
    }));

    const categoryMap = new Map<string, { category: string; revenue: number; count: number }>();
    completedOrders.forEach((o) => {
      const cat = o.product.category || 'other';
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, { category: cat, revenue: 0, count: 0 });
      }
      const item = categoryMap.get(cat)!;
      item.revenue += o.totalAmount;
      item.count += 1;
    });

    const categoryBreakdown = Array.from(categoryMap.values())
      .map((c) => ({
        ...c,
        revenue: Number(c.revenue.toFixed(2)),
        percentage: grossEarnings > 0 ? Number(((c.revenue / grossEarnings) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const productMap = new Map<string, { id: string; title: string; imageUrl?: string | null; totalRevenue: number; salesCount: number }>();
    completedOrders.forEach((o) => {
      const pid = o.product.id;
      if (!productMap.has(pid)) {
        productMap.set(pid, {
          id: pid,
          title: o.product.title,
          imageUrl: o.product.imageUrl,
          totalRevenue: 0,
          salesCount: 0,
        });
      }
      const item = productMap.get(pid)!;
      item.totalRevenue += o.totalAmount;
      item.salesCount += 1;
    });

    const topSellingProducts = Array.from(productMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5);

    const receivedMessagesCount = await prisma.message.count({
      where: { toUserId: userId },
    });

    const sentMessagesCount = await prisma.message.count({
      where: { from: userId },
    });

    const responseRate = receivedMessagesCount > 0
      ? Math.min(100, Math.round((sentMessagesCount / receivedMessagesCount) * 100))
      : 100;

    return {
      kpi: {
        grossEarnings: Number(grossEarnings.toFixed(2)),
        netEarnings: Number(netEarnings.toFixed(2)),
        inEscrowEarnings: Number(inEscrowEarnings.toFixed(2)),
        totalSalesCount,
        averageOrderValue,
        totalListings,
        activeListings,
        responseRate,
      },
      monthlyEarnings,
      categoryBreakdown,
      topSellingProducts,
      recentSales: completedOrders.slice(0, 8).map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        productTitle: o.product.title,
        buyerName: o.buyer.name,
        amount: o.totalAmount,
        netProfit: Number((o.totalAmount - o.platformFee).toFixed(2)),
        createdAt: o.createdAt,
      })),
    };
  }
}

export const analyticsService = new AnalyticsService();
