CREATE TYPE "WalletTopupStatus" AS ENUM ('CREATED', 'PAID', 'FAILED');

CREATE TABLE "WalletTopupPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT,
    "userId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "status" "WalletTopupStatus" NOT NULL DEFAULT 'CREATED',
    "creditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WalletTopupPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WalletTopupPayment_orderId_key" ON "WalletTopupPayment"("orderId");
CREATE UNIQUE INDEX "WalletTopupPayment_paymentId_key" ON "WalletTopupPayment"("paymentId");
CREATE INDEX "WalletTopupPayment_userId_status_idx" ON "WalletTopupPayment"("userId", "status");
ALTER TABLE "WalletTopupPayment" ADD CONSTRAINT "WalletTopupPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
