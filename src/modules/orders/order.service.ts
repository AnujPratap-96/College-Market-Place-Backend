import prisma from '../../lib/prisma';
import { orderRepository, OrderRepository } from './order.repository';
import { walletService } from '../wallet/wallet.service';
import { ApiError } from '../../utils/api-error';
import { OrderPaymentMethod, OrderStatus, OrderType, ProductStatus, ProductType } from '@prisma/client';
import { emitToUser } from '../../lib/socket';
import { getPlatformCommissionRate } from '../admin/settings.service';
import { domainEvents } from '../../lib/events';

const otpAttemptTracker = new Map<string, { attempts: number; lockedUntil: number }>();

function checkAndRecordOtpAttempt(key: string, isMatch: boolean, label: string) {
  const current = otpAttemptTracker.get(key);
  const now = Date.now();

  if (current && current.lockedUntil > now) {
    const remainingMinutes = Math.ceil((current.lockedUntil - now) / (60 * 1000));
    throw new ApiError(429, `Too many incorrect OTP attempts. ${label} verification is locked for ${remainingMinutes} minute(s).`);
  }

  if (!isMatch) {
    const attempts = (current?.attempts || 0) + 1;
    if (attempts >= 5) {
      otpAttemptTracker.set(key, { attempts: 0, lockedUntil: now + 15 * 60 * 1000 });
      throw new ApiError(429, `Too many incorrect OTP attempts. ${label} verification locked for 15 minutes.`);
    }
    otpAttemptTracker.set(key, { attempts, lockedUntil: 0 });
    throw new ApiError(400, `Invalid ${label.toLowerCase()} OTP. (${5 - attempts} attempt(s) remaining)`);
  }

  otpAttemptTracker.delete(key);
}

export class OrderService {
  constructor(private repo: OrderRepository = orderRepository) {}

  async checkout(
    buyerId: string,
    productId: string,
    paymentMethod: OrderPaymentMethod = 'WALLET',
    rentalDays?: number,
    securityDeposit?: number
  ) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new ApiError(404, 'Product not found.');
    }

    if (product.ownerId === buyerId) {
      throw new ApiError(400, 'You cannot purchase or rent your own product.');
    }

    if (product.status !== 'AVAILABLE') {
      throw new ApiError(400, `Product is not available (current status: ${product.status.toLowerCase()}).`);
    }

    const isRental = product.type === 'RENT';
    const days = isRental ? Math.max(1, rentalDays || 1) : null;
    const deposit = isRental ? (securityDeposit !== undefined ? securityDeposit : product.price) : 0.0;
    const itemOrRentalFee = isRental ? product.price * (days || 1) : product.price;
    const commissionRate = await getPlatformCommissionRate();
    const platformFee = Number((itemOrRentalFee * commissionRate).toFixed(2));
    const totalAmount = isRental ? itemOrRentalFee + deposit : itemOrRentalFee;

    // Generate 6-digit verification OTPs
    const pickupOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const returnOtp = isRental ? Math.floor(100000 + Math.random() * 900000).toString() : null;
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const createdOrder = await prisma.$transaction(
      async (tx) => {
        const lock = await tx.product.updateMany({
          where: { id: productId, version: product.version, status: 'AVAILABLE' },
          data: { status: ProductStatus.RESERVED, version: { increment: 1 } },
        });

        if (lock.count === 0) {
          throw new ApiError(409, 'This product was just purchased or modified by someone else. Please try again.');
        }

        const order = await this.repo.createOrder(
          {
            orderNumber,
            buyerId,
            sellerId: product.ownerId,
            productId,
            price: product.price,
            platformFee,
            totalAmount,
            orderType: isRental ? OrderType.RENTAL : OrderType.PURCHASE,
            rentalDays: days,
            securityDeposit: deposit,
            paymentMethod,
            pickupOtp,
            returnOtp,
            status: paymentMethod === 'CASH' ? OrderStatus.PENDING_PAYMENT : OrderStatus.ESCROW_HELD,
          },
          tx
        );

        if (paymentMethod === 'WALLET') {
          await walletService.holdEscrow(buyerId, totalAmount, order.id, tx);
        }

        return order;
      },
      { maxWait: 15000, timeout: 30000 }
    );

    domainEvents.emit('order:created', { orderId: createdOrder.id });

    return createdOrder;
  }

  async verifyHandoverWithOtp(sellerId: string, orderId: string, pickupOtp: string) {
    const order = await this.repo.findOrderById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found.');
    }

    if (order.sellerId !== sellerId) {
      throw new ApiError(403, 'Only the seller can verify delivery OTP and collect funds.');
    }

    if (order.status !== OrderStatus.ESCROW_HELD && order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new ApiError(400, `Cannot verify handover for an order in '${order.status}' status.`);
    }

    checkAndRecordOtpAttempt(`handover_${order.id}`, order.pickupOtp === pickupOtp, 'Delivery pickup');

    return prisma.$transaction(
      async (tx) => {
        if (order.orderType === OrderType.RENTAL) {
          // For rentals: release rental fee to seller, keep security deposit in escrow!
          const rentalFee = order.totalAmount - order.securityDeposit;
          if (order.paymentMethod === 'WALLET') {
            await walletService.releaseRentalHandover(
              order.buyerId,
              order.sellerId,
              rentalFee,
              order.platformFee,
              order.id,
              tx
            );
          }

          const now = new Date();
          const durationMs = (order.rentalDays || 1) * 24 * 60 * 60 * 1000;
          const endDate = new Date(now.getTime() + durationMs);

          await this.repo.updateProductStatus(order.productId, ProductStatus.RENTED, tx);

          return this.repo.updateOrder(
            order.id,
            {
              status: OrderStatus.RENTAL_ACTIVE,
              rentalStartDate: now,
              rentalEndDate: endDate,
            },
            tx
          );
        } else {
          // For purchases: release full escrow to seller and complete order
          if (order.paymentMethod === 'WALLET') {
            await walletService.releaseEscrow(
              order.buyerId,
              order.sellerId,
              order.totalAmount,
              order.platformFee,
              order.id,
              tx
            );
          }

          await this.repo.updateProductStatus(order.productId, ProductStatus.SOLD, tx);

          return this.repo.updateOrder(
            order.id,
            {
              status: OrderStatus.COMPLETED,
              completedAt: new Date(),
            },
            tx
          );
        }
      },
      { maxWait: 15000, timeout: 30000 }
    );
  }

  async verifyReturnWithOtp(sellerId: string, orderId: string, returnOtp: string) {
    const order = await this.repo.findOrderById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found.');
    }

    if (order.sellerId !== sellerId) {
      throw new ApiError(403, 'Only the seller can verify item return and release security deposit.');
    }

    if (order.orderType !== OrderType.RENTAL) {
      throw new ApiError(400, 'Return verification is only valid for rental orders.');
    }

    if (order.status !== OrderStatus.RENTAL_ACTIVE) {
      throw new ApiError(400, `Cannot verify return for order in '${order.status}' status.`);
    }

    checkAndRecordOtpAttempt(`return_${order.id}`, order.returnOtp === returnOtp, 'Rental return');

    return prisma.$transaction(
      async (tx) => {
        // Release held security deposit back to buyer's wallet!
        if (order.paymentMethod === 'WALLET' && order.securityDeposit > 0) {
          await walletService.refundSecurityDeposit(
            order.buyerId,
            order.securityDeposit,
            order.id,
            tx
          );
        }

        // Restore product status back to AVAILABLE for next renter!
        await this.repo.updateProductStatus(order.productId, ProductStatus.AVAILABLE, tx);

        // Complete order
        return this.repo.updateOrder(
          order.id,
          {
            status: OrderStatus.COMPLETED,
            completedAt: new Date(),
          },
          tx
        );
      },
      { maxWait: 15000, timeout: 30000 }
    );
  }

  async confirmReceived(buyerId: string, orderId: string) {
    const order = await this.repo.findOrderById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found.');
    }

    if (order.buyerId !== buyerId) {
      throw new ApiError(403, 'Only the buyer can confirm item receipt.');
    }

    if (order.status !== OrderStatus.ESCROW_HELD) {
      throw new ApiError(400, `Cannot confirm receipt for an order in '${order.status}' status.`);
    }

    return prisma.$transaction(
      async (tx) => {
        if (order.orderType === OrderType.RENTAL) {
          const rentalFee = order.totalAmount - order.securityDeposit;
          if (order.paymentMethod === 'WALLET') {
            await walletService.releaseRentalHandover(
              order.buyerId,
              order.sellerId,
              rentalFee,
              order.platformFee,
              order.id,
              tx
            );
          }

          const now = new Date();
          const durationMs = (order.rentalDays || 1) * 24 * 60 * 60 * 1000;
          const endDate = new Date(now.getTime() + durationMs);

          await this.repo.updateProductStatus(order.productId, ProductStatus.RENTED, tx);

          return this.repo.updateOrder(
            order.id,
            {
              status: OrderStatus.RENTAL_ACTIVE,
              rentalStartDate: now,
              rentalEndDate: endDate,
            },
            tx
          );
        } else {
          if (order.paymentMethod === 'WALLET') {
            await walletService.releaseEscrow(
              order.buyerId,
              order.sellerId,
              order.totalAmount,
              order.platformFee,
              order.id,
              tx
            );
          }

          await this.repo.updateProductStatus(order.productId, ProductStatus.SOLD, tx);

          return this.repo.updateOrder(
            order.id,
            {
              status: OrderStatus.COMPLETED,
              completedAt: new Date(),
            },
            tx
          );
        }
      },
      { maxWait: 15000, timeout: 30000 }
    );
  }

  async cancelOrder(userId: string, orderId: string) {
    const order = await this.repo.findOrderById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found.');
    }

    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ApiError(403, 'Not authorized to cancel this order.');
    }

    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
      throw new ApiError(400, `Order is already ${order.status.toLowerCase()}.`);
    }

    if (order.status === OrderStatus.RENTAL_ACTIVE) {
      throw new ApiError(400, 'Cannot cancel an active rental in progress. Please use the return flow.');
    }

    if (order.orderType === OrderType.AUCTION && order.buyerId === userId) {
      throw new ApiError(
        400,
        'Auction orders cannot be cancelled by the buyer. If the seller does not fulfill the handover, please raise a dispute.'
      );
    }

    return prisma.$transaction(
      async (tx) => {
        // Refund held escrow funds back to buyer
        if (order.status === OrderStatus.ESCROW_HELD && order.paymentMethod === 'WALLET') {
          await walletService.refundEscrow(order.buyerId, order.totalAmount, order.id, tx);
        }

        // Restore product status to AVAILABLE
        await this.repo.updateProductStatus(order.productId, ProductStatus.AVAILABLE, tx);

        return this.repo.updateOrder(
          order.id,
          {
            status: OrderStatus.CANCELLED,
            cancelledAt: new Date(),
          },
          tx
        );
      },
      { maxWait: 15000, timeout: 30000 }
    );
  }

  async getMyOrders(buyerId: string) {
    return this.repo.findOrdersByBuyer(buyerId);
  }

  async getMySales(sellerId: string) {
    return this.repo.findOrdersBySeller(sellerId);
  }

  async getOrderById(userId: string, orderId: string) {
    const order = await this.repo.findOrderById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found.');
    }

    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ApiError(403, 'Not authorized to view this order.');
    }

    return order;
  }

  async raiseDispute(userId: string, orderId: string, reason: string) {
    const order = await this.repo.findOrderById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found.');
    }

    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ApiError(403, 'Only the buyer or seller can raise a dispute for this order.');
    }

    if (order.status === OrderStatus.DISPUTED) {
      throw new ApiError(400, 'A dispute is already active for this order.');
    }

    if (
      order.status === OrderStatus.COMPLETED ||
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.REFUNDED
    ) {
      throw new ApiError(400, `Cannot raise a dispute on a finalized order (${order.status.toLowerCase()}).`);
    }

    const updatedOrder = await this.repo.updateOrder(orderId, {
      status: OrderStatus.DISPUTED,
      disputeReason: reason,
      disputedAt: new Date(),
    });

    const counterpartId = userId === order.buyerId ? order.sellerId : order.buyerId;
    emitToUser(counterpartId, 'order_disputed', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      disputedBy: userId,
      reason,
      message: `A dispute has been filed on order #${order.orderNumber} and escalated to administrative arbitration.`,
    });

    emitToUser(userId, 'order_disputed', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      disputedBy: userId,
      reason,
      message: `Your dispute on order #${order.orderNumber} has been logged and escalated to administrative arbitration.`,
    });

    return updatedOrder;
  }

  async bookService(buyerId: string, productId: string, preferredTime?: string, notes?: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new ApiError(404, 'Service listing not found.');
    }

    if (product.type !== ProductType.SERVICE) {
      throw new ApiError(400, 'This listing is not a service.');
    }

    if (product.ownerId === buyerId) {
      throw new ApiError(400, 'You cannot book your own service.');
    }

    const commissionRate = await getPlatformCommissionRate();
    const platformFee = Number((product.price * commissionRate).toFixed(2));
    const totalAmount = product.price;
    const orderNumber = `SRV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const createdOrder = await prisma.$transaction(
      async (tx) => {
        const order = await this.repo.createOrder(
          {
            orderNumber,
            buyerId,
            sellerId: product.ownerId,
            productId,
            price: product.price,
            platformFee,
            totalAmount,
            orderType: OrderType.SERVICE,
            paymentMethod: 'WALLET',
            status: OrderStatus.ESCROW_HELD,
            disputeReason: notes ? `Notes: ${notes}${preferredTime ? ` (Time: ${preferredTime})` : ''}` : undefined,
          },
          tx
        );

        await walletService.holdEscrow(buyerId, totalAmount, order.id, tx);

        emitToUser(product.ownerId, 'service_booked', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          buyerId,
          message: `A new service booking (#${order.orderNumber}) has been requested and funds held in escrow.`,
        });

        return order;
      },
      { maxWait: 15000, timeout: 30000 }
    );

    domainEvents.emit('order:created', { orderId: createdOrder.id });

    return createdOrder;
  }

  async completeService(providerId: string, orderId: string) {
    const order = await this.repo.findOrderById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found.');
    }

    if (order.sellerId !== providerId) {
      throw new ApiError(403, 'Only the service provider can mark this service as completed.');
    }

    if (order.orderType !== OrderType.SERVICE) {
      throw new ApiError(400, 'This action is only valid for service orders.');
    }

    if (order.status !== OrderStatus.ESCROW_HELD) {
      throw new ApiError(400, `Cannot mark completed for service in '${order.status}' status.`);
    }

    const updated = await this.repo.updateOrder(orderId, {
      status: OrderStatus.DELIVERED,
    });

    emitToUser(order.buyerId, 'service_completed_by_provider', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      message: `Provider has marked service #${order.orderNumber} as completed. Please confirm to release funds.`,
    });

    return updated;
  }

  async confirmService(buyerId: string, orderId: string) {
    const order = await this.repo.findOrderById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found.');
    }

    if (order.buyerId !== buyerId) {
      throw new ApiError(403, 'Only the client can confirm service completion.');
    }

    if (order.orderType !== OrderType.SERVICE) {
      throw new ApiError(400, 'This action is only valid for service orders.');
    }

    if (order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.ESCROW_HELD) {
      throw new ApiError(400, `Cannot confirm completion for service in '${order.status}' status.`);
    }

    return prisma.$transaction(
      async (tx) => {
        await walletService.releaseEscrow(
          order.buyerId,
          order.sellerId,
          order.totalAmount,
          order.platformFee,
          order.id,
          tx
        );

        const completedOrder = await this.repo.updateOrder(
          order.id,
          {
            status: OrderStatus.COMPLETED,
            completedAt: new Date(),
          },
          tx
        );

        emitToUser(order.sellerId, 'service_payment_released', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          message: `Client confirmed service #${order.orderNumber}. Payment has been credited to your wallet!`,
        });

        return completedOrder;
      },
      { maxWait: 15000, timeout: 30000 }
    );
  }
}

export const orderService = new OrderService();
