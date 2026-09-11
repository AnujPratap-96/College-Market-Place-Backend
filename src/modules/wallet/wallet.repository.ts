import prisma from '../../lib/prisma';
import { Wallet, WalletLedger, LedgerType, Prisma } from '@prisma/client';

export class WalletRepository {
  async getOrCreateWallet(userId: string, tx?: Prisma.TransactionClient): Promise<Wallet> {
    const client = tx || prisma;
    let wallet = await client.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      wallet = await client.wallet.create({
        data: {
          userId,
          balance: 0.0,
          escrowBalance: 0.0,
          currency: 'INR',
        },
      });
    }

    return wallet;
  }

  async findWalletByUserId(userId: string, tx?: Prisma.TransactionClient): Promise<Wallet | null> {
    const client = tx || prisma;
    return client.wallet.findUnique({
      where: { userId },
    });
  }

  async findUserByRecipient(recipient: string) {
    return prisma.user.findFirst({
      where: {
        OR: [
          { email: recipient.toLowerCase() },
          { phone: recipient },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        college: true,
      },
    });
  }

  async createLedgerEntry(
    data: Prisma.WalletLedgerUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ): Promise<WalletLedger> {
    const client = tx || prisma;
    return client.walletLedger.create({ data });
  }

  async updateBalances(
    walletId: string,
    balance: number,
    escrowBalance: number,
    tx?: Prisma.TransactionClient
  ): Promise<Wallet> {
    const client = tx || prisma;
    return client.wallet.update({
      where: { id: walletId },
      data: {
        balance,
        escrowBalance,
      },
    });
  }

  async getLedgerHistory(
    walletId: string,
    options: { page: number; limit: number; type?: LedgerType }
  ) {
    const skip = (options.page - 1) * options.limit;
    const where: Prisma.WalletLedgerWhereInput = { walletId };

    if (options.type) {
      where.type = options.type;
    }

    const [entries, total] = await Promise.all([
      prisma.walletLedger.findMany({
        where,
        skip,
        take: options.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.walletLedger.count({ where }),
    ]);

    return {
      entries,
      total,
      page: options.page,
      totalPages: Math.ceil(total / options.limit),
    };
  }

  async getMonthlyStats(walletId: string) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const credits = await prisma.walletLedger.aggregate({
      _sum: { amount: true },
      where: {
        walletId,
        type: { in: ['CREDIT', 'REFUND'] },
        createdAt: { gte: startOfMonth },
      },
    });

    const debits = await prisma.walletLedger.aggregate({
      _sum: { amount: true },
      where: {
        walletId,
        type: { in: ['DEBIT', 'HOLD'] },
        createdAt: { gte: startOfMonth },
      },
    });

    return {
      addedThisMonth: credits._sum.amount || 0.0,
      spentThisMonth: debits._sum.amount || 0.0,
    };
  }
}

export const walletRepository = new WalletRepository();
