import { adminRepository, AdminRepository } from './admin.repository';
import prisma from '../../lib/prisma';
import bcrypt from 'bcrypt';
import { ApiError } from '../../utils/api-error';
import { ReportStatus, OrderStatus, ProductStatus, OrderType } from '@prisma/client';
import { walletService } from '../wallet/wallet.service';
import { emitToUser } from '../../lib/socket';
import { settingsService } from './settings.service';
import { domainEvents } from '../../lib/events';
import { campusVectorService } from '../assistant/campus-vector.service';

export class AdminService {
  constructor(private repo: AdminRepository = adminRepository) {}

  async checkIsAdmin(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'ADMIN') {
      throw new ApiError(403, 'Access denied. Admin privileges required.');
    }
    return user;
  }

  async getDashboardStats(userId: string) {
    await this.checkIsAdmin(userId);
    return this.repo.getStats();
  }

  async getAllUsers(userId: string, page = 1, limit = 10, search?: string) {
    await this.checkIsAdmin(userId);
    return this.repo.getAllUsers(page, limit, search);
  }

  async getAllProducts(userId: string, page = 1, limit = 10, search?: string) {
    await this.checkIsAdmin(userId);
    return this.repo.getAllProducts(page, limit, search);
  }

  async getAllTransactions(userId: string, page = 1, limit = 10) {
    await this.checkIsAdmin(userId);
    return this.repo.getAllTransactions(page, limit);
  }

  async deleteUser(userId: string, targetUserId: string) {
    await this.checkIsAdmin(userId);
    if (userId === targetUserId) {
      throw new ApiError(400, 'You cannot delete yourself.');
    }
    return this.repo.deleteUser(targetUserId);
  }

  async toggleUserVerification(userId: string, targetUserId: string) {
    await this.checkIsAdmin(userId);
    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
      throw new ApiError(404, 'User not found.');
    }
    return this.repo.toggleVerification(targetUserId, !target.isVerified);
  }

  async deleteProduct(userId: string, targetProductId: string) {
    await this.checkIsAdmin(userId);
    const result = await this.repo.deleteProduct(targetProductId);
    campusVectorService.removeProduct(targetProductId);
    return result;
  }

  async createAdmin(userId: string, data: any) {
    await this.checkIsAdmin(userId);
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { phone: data.phone }] },
    });
    if (existing) {
      throw new ApiError(400, 'User with this email or phone already exists.');
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);
    return this.repo.createAdmin({
      ...data,
      password: hashedPassword,
      role: 'ADMIN',
      isVerified: true,
    });
  }

  async getReports(userId: string, page = 1, limit = 10, status?: ReportStatus) {
    await this.checkIsAdmin(userId);
    return this.repo.getReports(page, limit, status);
  }

  async handleReportAction(
    userId: string,
    reportId: string,
    action: 'DISMISS' | 'FLAG_PRODUCT' | 'UNFLAG_PRODUCT' | 'DELETE_PRODUCT',
    _notes?: string
  ) {
    await this.checkIsAdmin(userId);
    const report = await this.repo.getReportById(reportId);
    if (!report) {
      throw new ApiError(404, 'Report not found.');
    }

    if (action === 'DISMISS') {
      const updated = await this.repo.updateReportStatus(reportId, ReportStatus.DISMISSED);
      return { report: updated, message: 'Report dismissed' };
    }

    if (action === 'FLAG_PRODUCT') {
      await this.repo.updateProductFlag(report.productId, true);
      const updated = await this.repo.updateReportStatus(reportId, ReportStatus.RESOLVED);
      emitToUser(report.product.ownerId, 'product_moderation_alert', {
        productId: report.productId,
        message: 'Your product has been hidden by moderators following a safety review.',
      });
      return { report: updated, message: 'Product flagged and hidden from listings' };
    }

    if (action === 'UNFLAG_PRODUCT') {
      await this.repo.updateProductFlag(report.productId, false);
      const updated = await this.repo.updateReportStatus(reportId, ReportStatus.RESOLVED);
      emitToUser(report.product.ownerId, 'product_moderation_alert', {
        productId: report.productId,
        message: 'Your product has been cleared and restored to public listings.',
      });
      return { report: updated, message: 'Product cleared and restored to public listings' };
    }

    if (action === 'DELETE_PRODUCT') {
      await this.repo.updateReportStatus(reportId, ReportStatus.RESOLVED);
      await this.repo.deleteProduct(report.productId);
      emitToUser(report.product.ownerId, 'product_moderation_alert', {
        productId: report.productId,
        message: 'Your product listing was permanently removed due to policy violations.',
      });
      return { message: 'Product permanently removed and report resolved' };
    }

    throw new ApiError(400, 'Invalid moderation action.');
  }

  async getDisputes(userId: string, page = 1, limit = 10) {
    await this.checkIsAdmin(userId);
    return this.repo.getDisputedOrders(page, limit);
  }

  async resolveDispute(
    adminUserId: string,
    orderId: string,
    action: 'REFUND_BUYER' | 'RELEASE_SELLER',
    resolutionNote: string
  ) {
    await this.checkIsAdmin(adminUserId);
    const order = await this.repo.getOrderById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found.');
    }

    if (order.status !== OrderStatus.DISPUTED) {
      throw new ApiError(400, `Cannot arbitrate order: current status is '${order.status}' (expected DISPUTED).`);
    }

    const resolvedOrder = await prisma.$transaction(async (tx) => {
      const resolutionText = `[Admin Decision: ${action}] ${resolutionNote}`;

      if (action === 'REFUND_BUYER') {
        if (order.paymentMethod === 'WALLET') {
          if (order.orderType === OrderType.PURCHASE) {
            await walletService.refundEscrow(order.buyerId, order.totalAmount, order.id, tx);
          } else {
            if (order.securityDeposit > 0) {
              await walletService.refundSecurityDeposit(order.buyerId, order.securityDeposit, order.id, tx);
            }
          }
        }

        await tx.product.update({
          where: { id: order.productId },
          data: { status: ProductStatus.AVAILABLE },
        });

        const updatedOrder = await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.REFUNDED,
            disputeResolution: resolutionText,
            completedAt: new Date(),
          },
        });

        emitToUser(order.buyerId, 'dispute_resolved', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          decision: 'REFUND_BUYER',
          message: `Dispute on order #${order.orderNumber} resolved in your favor: Funds refunded.`,
        });

        emitToUser(order.sellerId, 'dispute_resolved', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          decision: 'REFUND_BUYER',
          message: `Dispute on order #${order.orderNumber} resolved: Escrow refunded to buyer.`,
        });

        return updatedOrder;
      } else {
        if (order.paymentMethod === 'WALLET') {
          if (order.orderType === OrderType.PURCHASE) {
            await walletService.releaseEscrow(
              order.buyerId,
              order.sellerId,
              order.totalAmount,
              order.platformFee,
              order.id,
              tx
            );
          } else {
            if (order.securityDeposit > 0) {
              await walletService.releaseSecurityDepositToSeller(
                order.buyerId,
                order.sellerId,
                order.securityDeposit,
                order.id,
                tx
              );
            }
          }
        }

        await tx.product.update({
          where: { id: order.productId },
          data: { status: order.orderType === OrderType.PURCHASE ? ProductStatus.SOLD : ProductStatus.AVAILABLE },
        });

        const updatedOrder = await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.COMPLETED,
            disputeResolution: resolutionText,
            completedAt: new Date(),
          },
        });

        emitToUser(order.sellerId, 'dispute_resolved', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          decision: 'RELEASE_SELLER',
          message: `Dispute on order #${order.orderNumber} resolved in your favor: Funds released to your wallet.`,
        });

        emitToUser(order.buyerId, 'dispute_resolved', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          decision: 'RELEASE_SELLER',
          message: `Dispute on order #${order.orderNumber} resolved in seller's favor.`,
        });

        return updatedOrder;
      }
    }, { maxWait: 15000, timeout: 30000 });

    domainEvents.emit('dispute:resolved', {
      orderId: resolvedOrder.id,
      decision: action,
      resolutionNote,
    });

    return resolvedOrder;
  }

  async getFinancialStats(userId: string) {
    await this.checkIsAdmin(userId);
    return this.repo.getFinancialStats();
  }

  async getSystemSettings(userId: string) {
    await this.checkIsAdmin(userId);
    return settingsService.getAllSettings();
  }

  async updateSystemSettings(userId: string, updates: Record<string, string>) {
    await this.checkIsAdmin(userId);
    return settingsService.updateSettings(updates);
  }

  async syncAssistantEmbeddings(userId: string) {
    await this.checkIsAdmin(userId);
    return campusVectorService.syncAllFromDatabase();
  }

  async getAssistantEmbeddingsStatus(userId: string) {
    await this.checkIsAdmin(userId);
    return campusVectorService.getStats();
  }
}

export const adminService = new AdminService();
