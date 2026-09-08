import { Request, Response } from 'express';
import prisma from '../prisma';

export const getAllRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const requests = await prisma.request.findMany({
      where: {
        OR: [
          { buyerId: userId },
          { sellerId: userId },
        ],
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            imageUrl: true,
          },
        },
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
            college: true,
            profileImage: true,
          },
        },
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            college: true,
            profileImage: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({ requests });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const getMySentRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const requests = await prisma.request.findMany({
      where: {
        buyerId: userId,
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            imageUrl: true,
          },
        },
        seller: {
          select: {
            id: true,
            name: true,
            college: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({ requests });
  } catch (error) {
    console.error('Get my sent requests error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const getMyReceivedRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const requests = await prisma.request.findMany({
      where: {
        sellerId: userId,
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            imageUrl: true,
          },
        },
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
            college: true,
            profileImage: true,
            phone: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({ requests });
  } catch (error) {
    console.error('Get my received requests error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const createRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { productId, message, totalAmount, platformFee } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!productId || !totalAmount) {
      res.status(400).json({ error: 'Product ID and total amount are required' });
      return;
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    if (product.ownerId === userId) {
      res.status(400).json({ error: 'You cannot request your own product' });
      return;
    }

    if (product.status !== 'AVAILABLE') {
      res.status(400).json({ error: 'Product is not available' });
      return;
    }

    const platformFeeAmount = platformFee || product.price * 0.02;

    const newRequest = await prisma.request.create({
      data: {
        productId,
        buyerId: userId,
        sellerId: product.ownerId,
        message: message || null,
        totalAmount: parseFloat(totalAmount),
        platformFee: platformFeeAmount,
      },
    });

    await prisma.product.update({
      where: { id: productId },
      data: { status: 'RESERVED' },
    });

    res.status(201).json({ message: 'Request sent successfully', request: newRequest });
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const acceptRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const id = req.params.id as string;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const request = await prisma.request.findUnique({
      where: { id },
    });

    if (!request) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    if (request.sellerId !== userId) {
      res.status(403).json({ error: 'Not authorized to accept this request' });
      return;
    }

    if (request.status !== 'PENDING') {
      res.status(400).json({ error: 'Request is not pending' });
      return;
    }

    const updatedRequest = await prisma.request.update({
      where: { id },
      data: { status: 'ACCEPTED' },
    });

    res.status(200).json({ message: 'Request accepted', request: updatedRequest });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const rejectRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const id = req.params.id as string;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const request = await prisma.request.findUnique({
      where: { id },
    });

    if (!request) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    if (request.sellerId !== userId) {
      res.status(403).json({ error: 'Not authorized to reject this request' });
      return;
    }

    if (request.status !== 'PENDING') {
      res.status(400).json({ error: 'Request is not pending' });
      return;
    }

    await prisma.request.update({
      where: { id },
      data: { status: 'REJECTED' },
    });

    await prisma.product.update({
      where: { id: request.productId },
      data: { status: 'AVAILABLE' },
    });

    res.status(200).json({ message: 'Request rejected' });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const cancelRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const id = req.params.id as string;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const request = await prisma.request.findUnique({
      where: { id },
    });

    if (!request) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    if (request.buyerId !== userId) {
      res.status(403).json({ error: 'Not authorized to cancel this request' });
      return;
    }

    if (request.status !== 'PENDING' && request.status !== 'ACCEPTED') {
      res.status(400).json({ error: 'Request cannot be cancelled' });
      return;
    }

    await prisma.request.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await prisma.product.update({
      where: { id: request.productId },
      data: { status: 'AVAILABLE' },
    });

    res.status(200).json({ message: 'Request cancelled' });
  } catch (error) {
    console.error('Cancel request error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const completeRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const id = req.params.id as string;
    const { paymentMethod } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const request = await prisma.request.findUnique({
      where: { id },
    });

    if (!request) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    if (request.sellerId !== userId) {
      res.status(403).json({ error: 'Only seller can mark as completed' });
      return;
    }

    if (request.status !== 'ACCEPTED') {
      res.status(400).json({ error: 'Request must be accepted first' });
      return;
    }

    const updatedRequest = await prisma.request.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });

    const transaction = await prisma.transaction.create({
      data: {
        requestId: id,
        paymentMethod: paymentMethod || 'CASH',
        paymentStatus: 'PENDING',
      },
    });

    await prisma.product.update({
      where: { id: request.productId },
      data: { status: 'SOLD' },
    });

    res.status(200).json({ message: 'Request completed', request: updatedRequest, transaction });
  } catch (error) {
    console.error('Complete request error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};