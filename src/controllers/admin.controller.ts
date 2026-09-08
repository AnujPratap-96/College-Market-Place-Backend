import { Request, Response } from 'express';
import prisma from '../prisma';
import bcrypt from 'bcrypt';

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user?.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const totalUsers = await prisma.user.count();
    const totalProducts = await prisma.product.count();
    const totalRequests = await prisma.request.count();
    const soldProducts = await prisma.product.count({
      where: { status: 'SOLD' },
    });
    const completedRequests = await prisma.request.count({
      where: { status: 'COMPLETED' },
    });

    const recentProducts = await prisma.product.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        owner: {
          select: {
            name: true,
            college: true,
          },
        },
      },
    });

    const recentRequests = await prisma.request.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        buyer: {
          select: { name: true },
        },
        seller: {
          select: { name: true },
        },
        product: {
          select: { title: true },
        },
      },
    });

    res.status(200).json({
      stats: {
        totalUsers,
        totalProducts,
        totalRequests,
        soldProducts,
        completedRequests,
      },
      recentProducts,
      recentRequests,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user?.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        college: true,
        branch: true,
        year: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ users });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const getAllProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user?.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const products = await prisma.product.findMany({
      include: {
        owner: {
          select: {
            name: true,
            email: true,
            college: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ products });
  } catch (error) {
    console.error('Get all products error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const getAllTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user?.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const transactions = await prisma.transaction.findMany({
      include: {
        request: {
          include: {
            product: {
              select: { title: true, price: true },
            },
            buyer: {
              select: { name: true, college: true },
            },
            seller: {
              select: { name: true, college: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ transactions });
  } catch (error) {
    console.error('Get all transactions error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const id = req.params.id as string;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (adminUser?.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const userToDelete = await prisma.user.findUnique({
      where: { id },
    });

    if (!userToDelete) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (userToDelete.role === 'ADMIN') {
      res.status(400).json({ error: 'Cannot delete admin user' });
      return;
    }

    await prisma.user.delete({
      where: { id },
    });

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const toggleUserVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const id = req.params.id as string;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (adminUser?.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isVerified: !targetUser.isVerified },
    });

    res.status(200).json({ message: 'User verification toggled', user: updatedUser });
  } catch (error) {
    console.error('Toggle user verification error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const id = req.params.id as string;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (adminUser?.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    await prisma.product.delete({
      where: { id },
    });

    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const createAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { email, password, name, phone, college, branch, year } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (adminUser?.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        college,
        branch,
        year,
        role: 'ADMIN',
        isVerified: true,
      },
    });

    res.status(201).json({ message: 'Admin created successfully', userId: newAdmin.id });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};