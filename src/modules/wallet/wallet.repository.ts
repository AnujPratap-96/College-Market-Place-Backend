import prisma from '../../lib/prisma';
import { Wallet, WalletLedger, LedgerType, Prisma } from '@prisma/client';
import { roundMoney } from '../../utils/money';

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

  /**
   * Acquires a row-level exclusive lock (SELECT ... FOR UPDATE) on the user's wallet
   * within an active transaction. Prevents concurrent double-spending.
   */
  async getOrCreateWalletForUpdate(userId: string, tx: Prisma.TransactionClient): Promise<Wallet> {
    await this.getOrCreateWallet(userId, tx);

    const lockedWallets = await tx.$queryRaw<Wallet[]>`
      SELECT * FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE
    `;

    if (!lockedWallets || lockedWallets.length === 0) {
      throw new Error(`Unable to acquire row lock on wallet for user ${userId}`);
    }

    return lockedWallets[0];
  }

  /**
   * Acquires row-level exclusive locks on two wallets in deterministic alphabetical order
   * to strictly avoid database deadlocks during peer-to-peer transfers.
   */
  async getWalletsForTransfer(
    fromUserId: string,
    toUserId: string,
    tx: Prisma.TransactionClient
  ): Promise<{ senderWallet: Wallet; recipientWallet: Wallet }> {
    const [firstId, secondId] = [fromUserId, toUserId].sort();

    await this.getOrCreateWallet(firstId, tx);
    await this.getOrCreateWallet(secondId, tx);

    const lockedFirst = await tx.$queryRaw<Wallet[]>`
      SELECT * FROM "Wallet" WHERE "userId" = ${firstId} FOR UPDATE
    `;
    const lockedSecond = await tx.$queryRaw<Wallet[]>`
      SELECT * FROM "Wallet" WHERE "userId" = ${secondId} FOR UPDATE
    `;

    const senderWallet = firstId === fromUserId ? lockedFirst[0] : lockedSecond[0];
    const recipientWallet = firstId === toUserId ? lockedFirst[0] : lockedSecond[0];

    return { senderWallet, recipientWallet };
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
        balance: roundMoney(Math.max(0, balance)),
        escrowBalance: roundMoney(Math.max(0, escrowBalance)),
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

    const [credits, debits] = await Promise.all([
      prisma.walletLedger.aggregate({
        _sum: { amount: true },
        where: {
          walletId,
          type: { in: ['CREDIT', 'REFUND'] },
          createdAt: { gte: startOfMonth },
        },
      }),
      prisma.walletLedger.aggregate({
        _sum: { amount: true },
        where: {
          walletId,
          type: { in: ['DEBIT', 'HOLD'] },
          createdAt: { gte: startOfMonth },
        },
      }),
    ]);

    return {
      addedThisMonth: credits._sum.amount || 0.0,
      spentThisMonth: debits._sum.amount || 0.0,
    };
  }
}

export const walletRepository = new WalletRepository();
