import prisma from '../../lib/prisma';
import { Order, OrderStatus, ProductStatus, Prisma } from '@prisma/client';

export class OrderRepository {
  async createOrder(
    data: Prisma.OrderUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ): Promise<Order> {
    const client = tx || prisma;
    return client.order.create({ data });
  }

  async findOrderById(id: string): Promise<any | null> {
    return prisma.order.findUnique({
      where: { id },
      include: {
        product: true,
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            college: true,
            profileImage: true,
          },
        },
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            college: true,
            profileImage: true,
          },
        },
      },
    });
  }

  async findOrdersByBuyer(buyerId: string): Promise<any[]> {
    return prisma.order.findMany({
      where: { buyerId },
      include: {
        product: true,
        seller: {
          select: {
            id: true,
            name: true,
            phone: true,
            college: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOrdersBySeller(sellerId: string): Promise<any[]> {
    return prisma.order.findMany({
      where: { sellerId },
      include: {
        product: true,
        buyer: {
          select: {
            id: true,
            name: true,
            phone: true,
            college: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateOrder(
    id: string,
    data: Prisma.OrderUpdateInput,
    tx?: Prisma.TransactionClient
  ): Promise<Order> {
    const client = tx || prisma;
    return client.order.update({
      where: { id },
      data,
    });
  }

  async updateProductStatus(
    productId: string,
    status: ProductStatus,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.product.update({
      where: { id: productId },
      data: { status },
    });
  }
}

export const orderRepository = new OrderRepository();
