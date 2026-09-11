import prisma from '../../lib/prisma';
import { WantedRequestStatus, OfferStatus } from '@prisma/client';

export class WantedRepository {
  async createRequest(data: {
    requesterId: string;
    title: string;
    description: string;
    category: string;
    budget: number;
    neededBy: Date;
  }) {
    return prisma.wantedRequest.create({
      data: {
        requesterId: data.requesterId,
        title: data.title,
        description: data.description,
        category: data.category,
        budget: data.budget,
        neededBy: data.neededBy,
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            college: true,
            branch: true,
            profileImage: true,
          },
        },
      },
    });
  }

  async findFilteredRequests(filters: {
    category?: string;
    search?: string;
    status?: WantedRequestStatus;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    } else {
      where.status = WantedRequestStatus.OPEN;
      where.neededBy = { gte: new Date() };
    }

    if (filters.category && filters.category !== 'ALL') {
      where.category = filters.category;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.wantedRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { neededBy: 'asc' },
        include: {
          requester: {
            select: {
              id: true,
              name: true,
              college: true,
              branch: true,
              profileImage: true,
            },
          },
          _count: {
            select: { offers: true },
          },
        },
      }),
      prisma.wantedRequest.count({ where }),
    ]);

    return {
      requests: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    return prisma.wantedRequest.findUnique({
      where: { id },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            college: true,
            branch: true,
            year: true,
            profileImage: true,
          },
        },
        offers: {
          orderBy: { amount: 'asc' },
          include: {
            offerer: {
              select: {
                id: true,
                name: true,
                college: true,
                branch: true,
                profileImage: true,
              },
            },
          },
        },
      },
    });
  }

  async createOffer(data: {
    requestId: string;
    offererId: string;
    amount: number;
    pickupLocation: string;
    message?: string;
  }) {
    return prisma.wantedOffer.create({
      data: {
        requestId: data.requestId,
        offererId: data.offererId,
        amount: data.amount,
        pickupLocation: data.pickupLocation,
        message: data.message,
      },
      include: {
        offerer: {
          select: {
            id: true,
            name: true,
            college: true,
            profileImage: true,
          },
        },
      },
    });
  }

  async findOfferById(offerId: string) {
    return prisma.wantedOffer.findUnique({
      where: { id: offerId },
      include: {
        request: {
          include: {
            requester: true,
          },
        },
        offerer: true,
      },
    });
  }

  async findMyRequests(userId: string) {
    return prisma.wantedRequest.findMany({
      where: { requesterId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        offers: {
          include: {
            offerer: {
              select: {
                id: true,
                name: true,
                college: true,
                profileImage: true,
              },
            },
          },
        },
      },
    });
  }

  async findMyOffers(userId: string) {
    return prisma.wantedOffer.findMany({
      where: { offererId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        request: {
          include: {
            requester: {
              select: {
                id: true,
                name: true,
                college: true,
                profileImage: true,
              },
            },
          },
        },
      },
    });
  }

  async updateRequestStatus(id: string, status: WantedRequestStatus, acceptedOfferId?: string) {
    return prisma.wantedRequest.update({
      where: { id },
      data: {
        status,
        acceptedOfferId: acceptedOfferId || undefined,
      },
    });
  }

  async updateOfferStatus(offerId: string, status: OfferStatus, orderId?: string) {
    return prisma.wantedOffer.update({
      where: { id: offerId },
      data: {
        status,
        orderId: orderId || undefined,
      },
    });
  }
}

export const wantedRepository = new WantedRepository();
