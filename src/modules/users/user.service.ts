import { userRepository, UserRepository } from './user.repository';
import { ApiError } from '../../utils/api-error';

export class UserService {
  constructor(private repo: UserRepository = userRepository) {}

  async getProfile(userId: string) {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found.');
    }
    const { password, ...safeUser } = user;
    return safeUser;
  }

  async updateProfile(userId: string, data: any) {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found.');
    }
    const profileImage = data.profileImage !== undefined ? data.profileImage : data.image;
    const phone = data.phone !== undefined ? data.phone : data.phoneNo;
    const cleanData = {
      ...(data.name && { name: data.name }),
      ...(phone && { phone }),
      ...(data.college && { college: data.college }),
      ...(data.branch && { branch: data.branch }),
      ...(data.year && { year: data.year }),
      ...(profileImage !== undefined && { profileImage }),
    };
    const updated = await this.repo.updateProfile(userId, cleanData);
    const { password, ...safeUser } = updated;
    return safeUser;
  }
}

export const userService = new UserService();
