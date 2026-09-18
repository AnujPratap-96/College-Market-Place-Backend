import { env } from '../../config/env';
import prisma from '../../lib/prisma';
import { walletRepository, WalletRepository } from './wallet.repository';
import { ApiError } from '../../utils/api-error';
import { LedgerType, Prisma } from '@prisma/client';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { getMinWithdrawalAmount, settingsService } from '../admin/settings.service';
import { domainEvents } from '../../lib/events';

export class WalletService {
  constructor(private repo: WalletRepository = walletRepository) {}

  async getWallet(userId: string) {
    const wallet = await this.repo.getOrCreateWallet(userId);
    const stats = await this.repo.getMonthlyStats(wallet.id);

    return {
      walletId: wallet.id,
      balance: wallet.balance,
      escrowBalance: wallet.escrowBalance,
      currency: wallet.currency,
      stats,
    };
  }

  async topup(userId: string, amount: number) {
    throw new ApiError(403, 'Direct wallet top-up is disabled. Complete a Razorpay payment to add funds.');

    if (amount <= 0) {
      throw new ApiError(400, 'Top-up amount must be greater than zero.');
    }

    return prisma.$transaction(
      async (tx) => {
        const wallet = await this.repo.getOrCreateWallet(userId, tx);
        const balanceBefore = wallet.balance;
        const balanceAfter = balanceBefore + amount;

        const updatedWallet = await this.repo.updateBalances(
          wallet.id,
          balanceAfter,
          wallet.escrowBalance,
          tx
        );

        const ledger = await this.repo.createLedgerEntry(
          {
            walletId: wallet.id,
            amount,
            type: LedgerType.CREDIT,
            balanceBefore,
            balanceAfter,
            escrowBefore: wallet.escrowBalance,
            escrowAfter: wallet.escrowBalance,
            referenceType: 'TOPUP',
            referenceId: `TOPUP-${Date.now()}`,
            description: `Wallet top-up of ₹${amount.toFixed(2)}`,
          },
          tx
        );

        return {
          wallet: updatedWallet,
          ledger,
        };
      },
      { maxWait: 15000, timeout: 30000 }
    );
  }

  async transfer(fromUserId: string, recipient: string, amount: number, note?: string) {
    if (amount <= 0) {
      throw new ApiError(400, 'Transfer amount must be greater than zero.');
    }

    const targetUser = await this.repo.findUserByRecipient(recipient);
    if (!targetUser) {
      throw new ApiError(404, 'Recipient user not found with provided phone or email.');
    }

    if (targetUser.id === fromUserId) {
      throw new ApiError(400, 'Cannot transfer wallet funds to yourself.');
    }

    const recipientUserId = targetUser.id;

    const result = await prisma.$transaction(
      async (tx) => {
        const senderWallet = await this.repo.getOrCreateWallet(fromUserId, tx);
        if (senderWallet.balance < amount) {
          throw new ApiError(400, `Insufficient wallet balance. Available: ₹${senderWallet.balance.toFixed(2)}`);
        }

        const recipientWallet = await this.repo.getOrCreateWallet(targetUser.id, tx);

        // 1. Deduct from sender
        const senderBefore = senderWallet.balance;
        const senderAfter = senderBefore - amount;
        await this.repo.updateBalances(senderWallet.id, senderAfter, senderWallet.escrowBalance, tx);

        const transferRef = `TRF-${Date.now()}`;
        await this.repo.createLedgerEntry(
          {
            walletId: senderWallet.id,
            amount,
            type: LedgerType.DEBIT,
            balanceBefore: senderBefore,
            balanceAfter: senderAfter,
            escrowBefore: senderWallet.escrowBalance,
            escrowAfter: senderWallet.escrowBalance,
            referenceType: 'TRANSFER_OUT',
            referenceId: transferRef,
            description: `Transfer to ${targetUser.name}${note ? ` (${note})` : ''}`,
          },
          tx
        );

        // 2. Credit to recipient
        const recipientBefore = recipientWallet.balance;
        const recipientAfter = recipientBefore + amount;
        await this.repo.updateBalances(recipientWallet.id, recipientAfter, recipientWallet.escrowBalance, tx);

        await this.repo.createLedgerEntry(
          {
            walletId: recipientWallet.id,
            amount,
            type: LedgerType.CREDIT,
            balanceBefore: recipientBefore,
            balanceAfter: recipientAfter,
            escrowBefore: recipientWallet.escrowBalance,
            escrowAfter: recipientWallet.escrowBalance,
            referenceType: 'TRANSFER_IN',
            referenceId: transferRef,
            description: `Transfer received from peer${note ? ` (${note})` : ''}`,
          },
          tx
        );

        return {
          transferId: transferRef,
          amount,
          recipient: {
            name: targetUser.name,
            email: targetUser.email,
          },
          senderBalance: senderAfter,
        };
      },
      { maxWait: 15000, timeout: 30000 }
    );

    domainEvents.emit('wallet:transferred', {
      fromUserId,
      toUserId: recipientUserId,
      amount,
      transferRef: result.transferId,
      note,
      senderBalance: result.senderBalance,
    });

    return result;
  }

  
  async triggerFirstTransactionBonus(userId: string, tx: Prisma.TransactionClient) {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || !user.referredById) return;

    // Check if this is their first transaction by counting HOLD entries
    const wallet = await this.repo.getOrCreateWallet(userId, tx);
    const holdCount = await tx.walletLedger.count({
      where: { walletId: wallet.id, type: LedgerType.HOLD }
    });

    // If holdCount is 0, this is their very first HOLD.
    if (holdCount === 0) {
      // Credit to Referrer
      const referrerWallet = await this.repo.getOrCreateWallet(user.referredById, tx);
      const referrerNewBalance = referrerWallet.balance + 50.0;
      await tx.wallet.update({ where: { id: referrerWallet.id }, data: { balance: referrerNewBalance } });
      await tx.walletLedger.create({
        data: {
          walletId: referrerWallet.id,
          amount: 50.0,
          type: LedgerType.CREDIT,
          balanceBefore: referrerWallet.balance,
          balanceAfter: referrerNewBalance,
          escrowBefore: referrerWallet.escrowBalance,
          escrowAfter: referrerWallet.escrowBalance,
          description: 'Referral bonus (friend made first purchase)',
          referenceType: 'REFERRAL_REWARD',
          referenceId: userId
        }
      });

      // Credit to Referee (New User)
      const userNewBalance = wallet.balance + 50.0;
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: userNewBalance } });
      await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          amount: 50.0,
          type: LedgerType.CREDIT,
          balanceBefore: wallet.balance,
          balanceAfter: userNewBalance,
          escrowBefore: wallet.escrowBalance,
          escrowAfter: wallet.escrowBalance,
          description: 'Welcome bonus (first purchase completed)',
          referenceType: 'SIGNUP_REWARD',
          referenceId: user.id
        }
      });
      
      // Clear referredById so we don't accidentally do it again (extra safety)
      await tx.user.update({
        where: { id: userId },
        data: { referredById: null }
      });
    }
  }
  async holdEscrow(buyerId: string, amount: number, orderId: string, tx: Prisma.TransactionClient) {
    await this.triggerFirstTransactionBonus(buyerId, tx);
    const wallet = await this.repo.getOrCreateWallet(buyerId, tx);

    if (wallet.balance < amount) {
      throw new ApiError(
        400,
        `Insufficient balance in wallet. Available: ₹${wallet.balance.toFixed(2)}, Required: ₹${amount.toFixed(2)}`
      );
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore - amount;
    const escrowBefore = wallet.escrowBalance;
    const escrowAfter = escrowBefore + amount;

    await this.repo.updateBalances(wallet.id, balanceAfter, escrowAfter, tx);

    await this.repo.createLedgerEntry(
      {
        walletId: wallet.id,
        amount,
        type: LedgerType.HOLD,
        balanceBefore,
        balanceAfter,
        escrowBefore,
        escrowAfter,
        referenceType: 'ORDER',
        referenceId: orderId,
        description: `Escrow hold for order #${orderId}`,
      },
      tx
    );

    return wallet;
  }

  async releaseEscrow(
    buyerId: string,
    sellerId: string,
    totalAmount: number,
    platformFee: number,
    orderId: string,
    tx: Prisma.TransactionClient
  ) {
    const buyerWallet = await this.repo.getOrCreateWallet(buyerId, tx);
    const sellerWallet = await this.repo.getOrCreateWallet(sellerId, tx);

    const buyerEscrowBefore = buyerWallet.escrowBalance;
    const buyerEscrowAfter = Math.max(0, buyerEscrowBefore - totalAmount);

    // 1. Release from buyer's escrow
    await this.repo.updateBalances(buyerWallet.id, buyerWallet.balance, buyerEscrowAfter, tx);
    await this.repo.createLedgerEntry(
      {
        walletId: buyerWallet.id,
        amount: totalAmount,
        type: LedgerType.RELEASE,
        balanceBefore: buyerWallet.balance,
        balanceAfter: buyerWallet.balance,
        escrowBefore: buyerEscrowBefore,
        escrowAfter: buyerEscrowAfter,
        referenceType: 'ORDER',
        referenceId: orderId,
        description: `Escrow released upon item handover for order #${orderId}`,
      },
      tx
    );

    // 2. Credit seller with payout (totalAmount - platformFee)
    const payoutAmount = Math.max(0, totalAmount - platformFee);
    const sellerBalanceBefore = sellerWallet.balance;
    const sellerBalanceAfter = sellerBalanceBefore + payoutAmount;

    await this.repo.updateBalances(sellerWallet.id, sellerBalanceAfter, sellerWallet.escrowBalance, tx);
    await this.repo.createLedgerEntry(
      {
        walletId: sellerWallet.id,
        amount: payoutAmount,
        type: LedgerType.CREDIT,
        balanceBefore: sellerBalanceBefore,
        balanceAfter: sellerBalanceAfter,
        escrowBefore: sellerWallet.escrowBalance,
        escrowAfter: sellerWallet.escrowBalance,
        referenceType: 'ORDER_PAYOUT',
        referenceId: orderId,
        description: `Payout for order #${orderId} (fee deducted: ₹${platformFee.toFixed(2)})`,
      },
      tx
    );
  }

  async releaseRentalHandover(
    buyerId: string,
    sellerId: string,
    rentalFee: number,
    platformFee: number,
    orderId: string,
    tx: Prisma.TransactionClient
  ) {
    const buyerWallet = await this.repo.getOrCreateWallet(buyerId, tx);
    const sellerWallet = await this.repo.getOrCreateWallet(sellerId, tx);

    const buyerEscrowBefore = buyerWallet.escrowBalance;
    const buyerEscrowAfter = Math.max(0, buyerEscrowBefore - rentalFee);

    // 1. Release rental fee from buyer's escrow (security deposit remains held in escrow!)
    await this.repo.updateBalances(buyerWallet.id, buyerWallet.balance, buyerEscrowAfter, tx);
    await this.repo.createLedgerEntry(
      {
        walletId: buyerWallet.id,
        amount: rentalFee,
        type: LedgerType.RELEASE,
        balanceBefore: buyerWallet.balance,
        balanceAfter: buyerWallet.balance,
        escrowBefore: buyerEscrowBefore,
        escrowAfter: buyerEscrowAfter,
        referenceType: 'RENTAL_FEE',
        referenceId: orderId,
        description: `Rental fee released upon pickup for order #${orderId}`,
      },
      tx
    );

    // 2. Credit seller with payout (rentalFee - platformFee)
    const payoutAmount = Math.max(0, rentalFee - platformFee);
    const sellerBalanceBefore = sellerWallet.balance;
    const sellerBalanceAfter = sellerBalanceBefore + payoutAmount;

    await this.repo.updateBalances(sellerWallet.id, sellerBalanceAfter, sellerWallet.escrowBalance, tx);
    await this.repo.createLedgerEntry(
      {
        walletId: sellerWallet.id,
        amount: payoutAmount,
        type: LedgerType.CREDIT,
        balanceBefore: sellerBalanceBefore,
        balanceAfter: sellerBalanceAfter,
        escrowBefore: sellerWallet.escrowBalance,
        escrowAfter: sellerWallet.escrowBalance,
        referenceType: 'RENTAL_PAYOUT',
        referenceId: orderId,
        description: `Rental payout for order #${orderId} (fee deducted: ₹${platformFee.toFixed(2)})`,
      },
      tx
    );
  }

  async refundSecurityDeposit(
    buyerId: string,
    depositAmount: number,
    orderId: string,
    tx: Prisma.TransactionClient
  ) {
    const buyerWallet = await this.repo.getOrCreateWallet(buyerId, tx);

    const escrowBefore = buyerWallet.escrowBalance;
    const escrowAfter = Math.max(0, escrowBefore - depositAmount);
    const balanceBefore = buyerWallet.balance;
    const balanceAfter = balanceBefore + depositAmount;

    await this.repo.updateBalances(buyerWallet.id, balanceAfter, escrowAfter, tx);
    await this.repo.createLedgerEntry(
      {
        walletId: buyerWallet.id,
        amount: depositAmount,
        type: LedgerType.REFUND,
        balanceBefore,
        balanceAfter,
        escrowBefore,
        escrowAfter,
        referenceType: 'SECURITY_DEPOSIT_REFUND',
        referenceId: orderId,
        description: `Security deposit refunded upon item return for order #${orderId}`,
      },
      tx
    );
  }

  async releaseSecurityDepositToSeller(
    buyerId: string,
    sellerId: string,
    depositAmount: number,
    orderId: string,
    tx: Prisma.TransactionClient
  ) {
    const buyerWallet = await this.repo.getOrCreateWallet(buyerId, tx);
    const sellerWallet = await this.repo.getOrCreateWallet(sellerId, tx);

    const escrowBefore = buyerWallet.escrowBalance;
    const escrowAfter = Math.max(0, escrowBefore - depositAmount);

    await this.repo.updateBalances(buyerWallet.id, buyerWallet.balance, escrowAfter, tx);
    await this.repo.createLedgerEntry(
      {
        walletId: buyerWallet.id,
        amount: depositAmount,
        type: LedgerType.RELEASE,
        balanceBefore: buyerWallet.balance,
        balanceAfter: buyerWallet.balance,
        escrowBefore,
        escrowAfter,
        referenceType: 'DEPOSIT_FORFEIT',
        referenceId: orderId,
        description: `Security deposit awarded to seller via dispute resolution for order #${orderId}`,
      },
      tx
    );

    const sellerBalanceBefore = sellerWallet.balance;
    const sellerBalanceAfter = sellerBalanceBefore + depositAmount;

    await this.repo.updateBalances(sellerWallet.id, sellerBalanceAfter, sellerWallet.escrowBalance, tx);
    await this.repo.createLedgerEntry(
      {
        walletId: sellerWallet.id,
        amount: depositAmount,
        type: LedgerType.CREDIT,
        balanceBefore: sellerBalanceBefore,
        balanceAfter: sellerBalanceAfter,
        escrowBefore: sellerWallet.escrowBalance,
        escrowAfter: sellerWallet.escrowBalance,
        referenceType: 'DEPOSIT_CLAIM',
        referenceId: orderId,
        description: `Security deposit claim payout for disputed order #${orderId}`,
      },
      tx
    );
  }

  async refundEscrow(buyerId: string, amount: number, orderId: string, tx: Prisma.TransactionClient) {
    const buyerWallet = await this.repo.getOrCreateWallet(buyerId, tx);

    const escrowBefore = buyerWallet.escrowBalance;
    const escrowAfter = Math.max(0, escrowBefore - amount);
    const balanceBefore = buyerWallet.balance;
    const balanceAfter = balanceBefore + amount;

    await this.repo.updateBalances(buyerWallet.id, balanceAfter, escrowAfter, tx);
    await this.repo.createLedgerEntry(
      {
        walletId: buyerWallet.id,
        amount,
        type: LedgerType.REFUND,
        balanceBefore,
        balanceAfter,
        escrowBefore,
        escrowAfter,
        referenceType: 'ORDER_REFUND',
        referenceId: orderId,
        description: `Refund for cancelled order #${orderId}`,
      },
      tx
    );
  }

  async holdAuctionBid(
    bidderId: string,
    amount: number,
    auctionId: string,
    tx: Prisma.TransactionClient
  ) {
    await this.triggerFirstTransactionBonus(bidderId, tx);
    const wallet = await this.repo.getOrCreateWallet(bidderId, tx);

    if (wallet.balance < amount) {
      throw new ApiError(
        400,
        `Insufficient balance in wallet. Available: ₹${wallet.balance.toFixed(2)}, Required: ₹${amount.toFixed(2)}`
      );
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore - amount;
    const escrowBefore = wallet.escrowBalance;
    const escrowAfter = escrowBefore + amount;

    await this.repo.updateBalances(wallet.id, balanceAfter, escrowAfter, tx);

    await this.repo.createLedgerEntry(
      {
        walletId: wallet.id,
        amount,
        type: LedgerType.HOLD,
        balanceBefore,
        balanceAfter,
        escrowBefore,
        escrowAfter,
        referenceType: 'AUCTION_BID',
        referenceId: auctionId,
        description: `Escrow hold for auction bid #${auctionId}`,
      },
      tx
    );

    return wallet;
  }

  async refundAuctionBid(
    bidderId: string,
    amount: number,
    auctionId: string,
    reason: string,
    tx: Prisma.TransactionClient
  ) {
    const wallet = await this.repo.getOrCreateWallet(bidderId, tx);

    const escrowBefore = wallet.escrowBalance;
    const escrowAfter = Math.max(0, escrowBefore - amount);
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + amount;

    await this.repo.updateBalances(wallet.id, balanceAfter, escrowAfter, tx);

    await this.repo.createLedgerEntry(
      {
        walletId: wallet.id,
        amount,
        type: LedgerType.REFUND,
        balanceBefore,
        balanceAfter,
        escrowBefore,
        escrowAfter,
        referenceType: 'AUCTION_REFUND',
        referenceId: auctionId,
        description: reason,
      },
      tx
    );

    return wallet;
  }

  async holdSubscriptionEscrow(
    subscriberId: string,
    amount: number,
    subscriptionId: string,
    tx: Prisma.TransactionClient
  ) {
    const wallet = await this.repo.getOrCreateWallet(subscriberId, tx);

    if (wallet.balance < amount) {
      throw new ApiError(
        400,
        `Insufficient balance in wallet for subscription. Available: ₹${wallet.balance.toFixed(2)}, Required: ₹${amount.toFixed(2)}`
      );
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore - amount;
    const escrowBefore = wallet.escrowBalance;
    const escrowAfter = escrowBefore + amount;

    await this.repo.updateBalances(wallet.id, balanceAfter, escrowAfter, tx);
    await this.repo.createLedgerEntry(
      {
        walletId: wallet.id,
        amount,
        type: LedgerType.HOLD,
        balanceBefore,
        balanceAfter,
        escrowBefore,
        escrowAfter,
        referenceType: 'SUBSCRIPTION',
        referenceId: subscriptionId,
        description: `Escrow cycle hold for subscription #${subscriptionId}`,
      },
      tx
    );

    return wallet;
  }

  async refundSubscriptionVacation(
    subscriberId: string,
    refundAmount: number,
    subscriptionId: string,
    vacationDays: number,
    tx: Prisma.TransactionClient
  ) {
    const wallet = await this.repo.getOrCreateWallet(subscriberId, tx);

    const escrowBefore = wallet.escrowBalance;
    const escrowAfter = Math.max(0, escrowBefore - refundAmount);
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + refundAmount;

    await this.repo.updateBalances(wallet.id, balanceAfter, escrowAfter, tx);
    await this.repo.createLedgerEntry(
      {
        walletId: wallet.id,
        amount: refundAmount,
        type: LedgerType.REFUND,
        balanceBefore,
        balanceAfter,
        escrowBefore,
        escrowAfter,
        referenceType: 'SUBSCRIPTION_VACATION_REFUND',
        referenceId: subscriptionId,
        description: `Pro-rata refund for ${vacationDays} paused day(s) on subscription #${subscriptionId}`,
      },
      tx
    );
  }

  async refundSubscriptionMissed(
    subscriberId: string,
    refundAmount: number,
    subscriptionId: string,
    deliveryId: string,
    tx: Prisma.TransactionClient
  ) {
    const wallet = await this.repo.getOrCreateWallet(subscriberId, tx);

    const escrowBefore = wallet.escrowBalance;
    const escrowAfter = Math.max(0, escrowBefore - refundAmount);
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + refundAmount;

    await this.repo.updateBalances(wallet.id, balanceAfter, escrowAfter, tx);
    await this.repo.createLedgerEntry(
      {
        walletId: wallet.id,
        amount: refundAmount,
        type: LedgerType.REFUND,
        balanceBefore,
        balanceAfter,
        escrowBefore,
        escrowAfter,
        referenceType: 'SUBSCRIPTION_MISSED_REFUND',
        referenceId: deliveryId,
        description: `Pro-rata refund for missed delivery on subscription #${subscriptionId}`,
      },
      tx
    );
  }

  async settleSubscriptionCycle(
    subscriberId: string,
    providerId: string,
    escrowDeductAmount: number,
    providerPayout: number,
    platformFee: number,
    subscriptionId: string,
    tx: Prisma.TransactionClient
  ) {
    const subscriberWallet = await this.repo.getOrCreateWallet(subscriberId, tx);
    const providerWallet = await this.repo.getOrCreateWallet(providerId, tx);

    const subscriberEscrowBefore = subscriberWallet.escrowBalance;
    const subscriberEscrowAfter = Math.max(0, subscriberEscrowBefore - escrowDeductAmount);

    await this.repo.updateBalances(subscriberWallet.id, subscriberWallet.balance, subscriberEscrowAfter, tx);
    await this.repo.createLedgerEntry(
      {
        walletId: subscriberWallet.id,
        amount: escrowDeductAmount,
        type: LedgerType.RELEASE,
        balanceBefore: subscriberWallet.balance,
        balanceAfter: subscriberWallet.balance,
        escrowBefore: subscriberEscrowBefore,
        escrowAfter: subscriberEscrowAfter,
        referenceType: 'SUBSCRIPTION_SETTLEMENT',
        referenceId: subscriptionId,
        description: `Escrow released upon cycle completion for subscription #${subscriptionId}`,
      },
      tx
    );

    const providerBalanceBefore = providerWallet.balance;
    const providerBalanceAfter = providerBalanceBefore + providerPayout;

    await this.repo.updateBalances(providerWallet.id, providerBalanceAfter, providerWallet.escrowBalance, tx);
    await this.repo.createLedgerEntry(
      {
        walletId: providerWallet.id,
        amount: providerPayout,
        type: LedgerType.CREDIT,
        balanceBefore: providerBalanceBefore,
        balanceAfter: providerBalanceAfter,
        escrowBefore: providerWallet.escrowBalance,
        escrowAfter: providerWallet.escrowBalance,
        referenceType: 'SUBSCRIPTION_PAYOUT',
        referenceId: subscriptionId,
        description: `Subscription cycle payout for #${subscriptionId} (fee deducted: ₹${platformFee.toFixed(2)})`,
      },
      tx
    );
  }

  async getHistory(userId: string, options: { page?: number; limit?: number; type?: LedgerType }) {
    const wallet = await this.repo.getOrCreateWallet(userId);
    const page = options.page || 1;
    const limit = options.limit || 15;

    return this.repo.getLedgerHistory(wallet.id, {
      page,
      limit,
      type: options.type,
    });
  }

  async getStats(userId: string) {
    const wallet = await this.repo.getOrCreateWallet(userId);
    return this.repo.getMonthlyStats(wallet.id);
  }

  async withdraw(userId: string, upiId: string, amount: number) {
    if (amount <= 0) {
      throw new ApiError(400, 'Withdrawal amount must be greater than zero.');
    }

    const minAmount = await getMinWithdrawalAmount();
    if (amount < minAmount) {
      throw new ApiError(400, `Minimum withdrawal amount is ₹${minAmount}.`);
    }

    const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
    if (!upiRegex.test(upiId)) {
      throw new ApiError(400, 'Invalid UPI ID format (e.g. username@upi).');
    }

    const gatewayMode = await settingsService.getPayoutGatewayMode();

    return prisma.$transaction(
      async (tx) => {
        const wallet = await this.repo.getOrCreateWallet(userId, tx);
        if (wallet.balance < amount) {
          throw new ApiError(400, `Insufficient wallet balance. Available: ₹${wallet.balance.toFixed(2)}`);
        }

        const balanceBefore = wallet.balance;
        const balanceAfter = balanceBefore - amount;

        const updatedWallet = await this.repo.updateBalances(
          wallet.id,
          balanceAfter,
          wallet.escrowBalance,
          tx
        );

        const withdrawalRef = `WTH-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
        const ledger = await this.repo.createLedgerEntry(
          {
            walletId: wallet.id,
            amount,
            type: LedgerType.DEBIT,
            balanceBefore,
            balanceAfter,
            escrowBefore: wallet.escrowBalance,
            escrowAfter: wallet.escrowBalance,
            referenceType: 'WITHDRAWAL',
            referenceId: withdrawalRef,
            description: `Withdrawal to UPI (${upiId})`,
          },
          tx
        );

        const withdrawalRecord = await tx.withdrawalRequest.create({
          data: {
            userId,
            amount,
            upiId,
            status: 'SUCCESS',
            utr: `UTR${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`,
          },
        });

        return {
          withdrawalId: withdrawalRef,
          amount,
          upiId,
          status: 'PROCESSED',
          mode: gatewayMode,
          wallet: updatedWallet,
          ledger,
          withdrawal: withdrawalRecord,
        };
      },
      { maxWait: 15000, timeout: 30000 }
    );
  }

  async getWithdrawals(userId: string) {
    return prisma.withdrawalRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private getRazorpayClient(): Razorpay | null {
    const keyId = env.RAZORPAY_KEY_ID;
    const keySecret = env.RAZORPAY_KEY_SECRET;
    if (keyId && keySecret && !keyId.includes('placeholder')) {
      return new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
    }
    return null;
  }

  async createPaymentOrder(userId: string, amount: number) {
    if (amount <= 0) {
      throw new ApiError(400, 'Amount must be greater than zero.');
    }
    await this.repo.getOrCreateWallet(userId);
    const keyId = env.RAZORPAY_KEY_ID;
    const client = this.getRazorpayClient();

    if (!client || !keyId) {
      throw new ApiError(503, 'Razorpay is not configured. Wallet top-up is unavailable.');
    }

    if (client) {
      try {
        const order = await (client.orders as any).create({
          amount: Math.round(amount * 100),
          currency: 'INR',
          receipt: `rcpt_${Date.now()}`,
          notes: { userId, purpose: 'WALLET_TOPUP' },
        });
        await prisma.walletTopupPayment.create({
          data: { orderId: order.id, userId, amountPaise: Number(order.amount) },
        });
        return {
          orderId: order.id,
          amount: Number(order.amount),
          currency: order.currency,
          keyId,
        };
      } catch (err: any) {
        throw new ApiError(502, `Razorpay gateway error: ${err.message || 'Failed to create order'}`);
      }
    }

    throw new ApiError(503, 'Razorpay payment order could not be created.');
  }

  async verifyPayment(
    userId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string | undefined,
    amount: number
  ): Promise<{ wallet: any; ledger: any }> {
    throw new ApiError(410, 'Client payment verification is disabled. Wallet credit is performed by the Razorpay webhook.');
    /*
    if (amount <= 0) {
      throw new ApiError(400, 'Invalid payment amount.');
    }

    const secret = env.RAZORPAY_KEY_SECRET;
    if (secret) {
      if (!razorpaySignature) {
        throw new ApiError(400, 'Razorpay signature is required for payment verification.');
      }
      const generatedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (generatedSignature !== razorpaySignature) {
        throw new ApiError(400, 'Invalid payment signature. Gateway verification failed.');
      }
    } else if (env.NODE_ENV === 'production') {
      throw new ApiError(500, 'Payment gateway secret not configured.');
    }

    return prisma.$transaction(
      async (tx) => {
        const wallet = await this.repo.getOrCreateWallet(userId, tx);
        const balanceBefore = wallet.balance;
        const balanceAfter = balanceBefore + amount;

        const updatedWallet = await this.repo.updateBalances(
          wallet.id,
          balanceAfter,
          wallet.escrowBalance,
          tx
        );

        const ledger = await this.repo.createLedgerEntry(
          {
            walletId: wallet.id,
            amount,
            type: LedgerType.CREDIT,
            balanceBefore,
            balanceAfter,
            escrowBefore: wallet.escrowBalance,
            escrowAfter: wallet.escrowBalance,
            referenceType: 'PAYMENT_GATEWAY',
            referenceId: razorpayPaymentId,
            description: `Recharge via Razorpay Sandbox (${razorpayPaymentId})`,
          },
          tx
        );

        return {
          wallet: updatedWallet,
          ledger,
        };
      },
      { maxWait: 15000, timeout: 30000 }
    );*/
  }

  
  async handleRazorpayWebhook(rawBody: Buffer, signature: string | undefined, event: any) {
    const secret = env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) throw new ApiError(500, 'Razorpay webhook secret is not configured.');
    if (!signature) throw new ApiError(400, 'Missing Razorpay webhook signature.');
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      throw new ApiError(401, 'Invalid Razorpay webhook signature.');
    }
    
    const payload = event.payload?.payment?.entity;
    if (!payload || !payload.id || !payload.order_id) {
      throw new ApiError(400, 'Invalid Razorpay payment payload.');
    }
    
    return prisma.$transaction(async (tx) => {
      const orderId = payload.order_id;
      const paymentId = payload.id;
      
      const topup = await tx.walletTopupPayment.findUnique({
        where: { orderId },
        include: { user: true }
      });
      
      if (!topup) return { handled: true, duplicate: false, notFound: true };
      if (topup.status === 'PAID') return { handled: true, duplicate: true };
      
      const wallet = await this.repo.getOrCreateWallet(topup.userId, tx as any);
      const newBalance = wallet.balance + topup.amountPaise / 100;
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance }
      });
      const ledger = await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          amount: topup.amountPaise / 100,
          type: LedgerType.CREDIT,
          balanceBefore: wallet.balance,
          balanceAfter: newBalance,
          escrowBefore: wallet.escrowBalance,
          escrowAfter: wallet.escrowBalance,
          referenceType: 'TOPUP',
          referenceId: paymentId,
          description: `Recharge via Razorpay (${paymentId})`,
        }
      });
      await tx.walletTopupPayment.update({
        where: { orderId },
        data: { paymentId, status: 'PAID', creditedAt: new Date() },
      });
      return { handled: true, duplicate: false, wallet: updatedWallet, ledger };
    });
  }

  async creditReferralBonus(referrerId: string, referredUserId: string, amount: number) {
    return prisma.$transaction(async (tx) => {
      const wallet = await this.repo.getOrCreateWallet(referrerId, tx as any);
      const newBalance = wallet.balance + amount;
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });
      await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          amount,
          type: LedgerType.CREDIT,
          balanceBefore: wallet.balance,
          balanceAfter: newBalance,
          escrowBefore: wallet.escrowBalance,
          escrowAfter: wallet.escrowBalance,
          description: 'Referral bonus for inviting new user',
          referenceType: 'REFERRAL_REWARD',
          referenceId: referredUserId
        }
      });
    });
  }

  async creditSignupBonus(userId: string, amount: number) {
    return prisma.$transaction(async (tx) => {
      const wallet = await this.repo.getOrCreateWallet(userId, tx as any);
      const newBalance = wallet.balance + amount;
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });
      await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          amount,
          type: LedgerType.CREDIT,
          balanceBefore: wallet.balance,
          balanceAfter: newBalance,
          escrowBefore: wallet.escrowBalance,
          escrowAfter: wallet.escrowBalance,
          description: 'Welcome bonus for using a referral code',
          referenceType: 'SIGNUP_REWARD',
          referenceId: userId
        }
      });
    });
  }
}

export const walletService = new WalletService();
