import { Request, Response } from 'express';
import prisma from '../prisma';

export const getAllProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const products = await prisma.product.findMany({
      where: {
        status: 'AVAILABLE',
      },
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({ products });
  } catch (error) {
    console.error('Get all products error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const getProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const product = await prisma.product.findUnique({
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
      },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.status(200).json({ product });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const getFilteredProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, category, type } = req.query;

    const filterConditions: any = {
      status: 'AVAILABLE',
    };

    if (q) {
      filterConditions.title = { contains: q as string, mode: 'insensitive' };
    }

    if (category && category !== 'ALL') {
      filterConditions.category = category as string;
    }

    if (type && type !== 'ALL') {
      filterConditions.type = type as 'SELL' | 'RENT';
    }

    const products = await prisma.product.findMany({
      where: filterConditions,
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
    });

    res.status(200).json({ products });
  } catch (error) {
    console.error('Get filtered products error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const getMyProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const products = await prisma.product.findMany({
      where: {
        ownerId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({ products });
  } catch (error) {
    console.error('Get my products error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { title, description, price, type, category, imageUrl } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!title || !description || !price || !type || !category) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    const newProduct = await prisma.product.create({
      data: {
        title,
        description,
        price: parseFloat(price),
        type,
        category,
        imageUrl: imageUrl || null,
        ownerId: userId,
      },
    });

    res.status(201).json({ message: 'Product created successfully', product: newProduct });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const id = req.params.id as string;
    const { title, description, price, type, category, imageUrl } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    if (existingProduct.ownerId !== userId) {
      res.status(403).json({ error: 'Not authorized to update this product' });
      return;
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        title: title || existingProduct.title,
        description: description || existingProduct.description,
        price: price ? parseFloat(price) : existingProduct.price,
        type: type || existingProduct.type,
        category: category || existingProduct.category,
        imageUrl: imageUrl || existingProduct.imageUrl,
      },
    });

    res.status(200).json({ message: 'Product updated successfully', product: updatedProduct });
  } catch (error) {
    console.error('Update product error:', error);
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

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    if (existingProduct.ownerId !== userId) {
      res.status(403).json({ error: 'Not authorized to delete this product' });
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

export const markProductSold = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const id = req.params.id as string;
    const { buyerId } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    if (existingProduct.ownerId !== userId) {
      res.status(403).json({ error: 'Not authorized to mark this product as sold' });
      return;
    }

    const buyer = await prisma.user.findUnique({
      where: { id: buyerId },
    });

    if (!buyer) {
      res.status(404).json({ error: 'Buyer not found' });
      return;
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        status: 'SOLD',
      },
    });

    res.status(200).json({ message: 'Product marked as sold', product: updatedProduct });
  } catch (error) {
    console.error('Mark product sold error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};