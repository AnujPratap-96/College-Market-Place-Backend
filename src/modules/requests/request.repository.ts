import prisma from '../../lib/prisma';
import { Request, RequestStatus, PaymentMethod } from '@prisma/client';

export class RequestRepository {
  async findAllByUser(userId: string): Promise<any[]> {
    return prisma.request.findMany({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }],
      },
      include: {
        product: {
          select: { id: true, title: true, price: true, imageUrl: true },
        },
        buyer: {
          select: { id: true, name: true, email: true, college: true, profileImage: true },
        },
        seller: {
          select: { id: true, name: true, email: true, college: true, profileImage: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findSentByUser(buyerId: string): Promise<any[]> {
    return prisma.request.findMany({
      where: { buyerId },
      include: {
        product: {
          select: { id: true, title: true, price: true, imageUrl: true },
        },
        seller: {
          select: { id: true, name: true, college: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findReceivedByUser(sellerId: string): Promise<any[]> {
    return prisma.request.findMany({
      where: { sellerId },
      include: {
        product: {
          select: { id: true, title: true, price: true, imageUrl: true },
        },
        buyer: {
          select: { id: true, name: true, email: true, college: true, profileImage: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<any | null> {
    return prisma.request.findUnique({
      where: { id },
      include: { product: true },
    });
  }

  async createRequest(data: {
    productId: string;
    buyerId: string;
    sellerId: string;
    message?: string | null;
    totalAmount: number;
    platformFee: number;
  }): Promise<Request> {
    return prisma.$transaction(
      async (tx) => {
        const request = await tx.request.create({
          data,
        });

        await tx.product.update({
          where: { id: data.productId },
          data: { status: 'RESERVED' },
        });

        return request;
      },
      { maxWait: 15000, timeout: 30000 }
    );
  }

  async updateStatus(id: string, status: RequestStatus): Promise<Request> {
    return prisma.request.update({
      where: { id },
      data: { status },
    });
  }

  async cancelOrRejectRequest(id: string, productId: string, status: RequestStatus): Promise<Request> {
    return prisma.$transaction(
      async (tx) => {
        const request = await tx.request.update({
          where: { id },
          data: { status },
        });

        await tx.product.update({
          where: { id: productId },
          data: { status: 'AVAILABLE' },
        });

        return request;
      },
      { maxWait: 15000, timeout: 30000 }
    );
  }

  async completeRequest(id: string, productId: string, paymentMethod: PaymentMethod): Promise<{ request: Request; transaction: any }> {
    return prisma.$transaction(
      async (tx) => {
        const request = await tx.request.update({
          where: { id },
          data: { status: 'COMPLETED' },
        });

        const transaction = await tx.transaction.create({
          data: {
            requestId: id,
            paymentMethod,
            paymentStatus: 'PENDING',
          },
        });

        await tx.product.update({
          where: { id: productId },
          data: { status: 'SOLD' },
        });

        return { request, transaction };
      },
      { maxWait: 15000, timeout: 30000 }
    );
  }
}

export const requestRepository = new RequestRepository();
