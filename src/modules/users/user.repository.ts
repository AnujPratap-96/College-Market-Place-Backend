import prisma from '../../lib/prisma';
import { User } from '@prisma/client';

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async updateProfile(id: string, data: Partial<Pick<User, 'name' | 'college' | 'branch' | 'year' | 'phone' | 'profileImage'>>): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }
}

export const userRepository = new UserRepository();
