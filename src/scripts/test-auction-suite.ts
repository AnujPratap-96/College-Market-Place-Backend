import prisma from '../lib/prisma';
import { auctionService } from '../modules/auctions/auction.service';
import { walletService } from '../modules/wallet/wallet.service';
import { orderService } from '../modules/orders/order.service';
import { settingsService } from '../modules/admin/settings.service';
import { Role, AuctionStatus, OrderStatus, ProductStatus } from '@prisma/client';

async function runAuctionTestSuite() {
  const timestamp = Date.now();
  const rand = Math.floor(1000 + Math.random() * 9000);

  console.log('Stage 1: Creating users...');
  const seller = await prisma.user.create({
    data: {
      name: 'Graduating Senior',
      email: `seller_${timestamp}_${rand}@test.edu`,
      phone: `91${timestamp.toString().slice(-6)}${rand.toString().slice(-2)}`,
      college: 'IIT Delhi',
      branch: 'Mechanical',
      year: 'Final Year',
      password: 'hash',
      role: Role.USER,
      isVerified: true,
    },
  });

  const bidder1 = await prisma.user.create({
    data: {
      name: 'Bidder Alpha',
      email: `bidder1_${timestamp}_${rand}@test.edu`,
      phone: `92${timestamp.toString().slice(-6)}${rand.toString().slice(-2)}`,
      college: 'IIT Delhi',
      branch: 'Computer Science',
      year: '2nd Year',
      password: 'hash',
      role: Role.USER,
      isVerified: true,
    },
  });

  const bidder2 = await prisma.user.create({
    data: {
      name: 'Bidder Beta',
      email: `bidder2_${timestamp}_${rand}@test.edu`,
      phone: `93${timestamp.toString().slice(-6)}${rand.toString().slice(-2)}`,
      college: 'IIT Delhi',
      branch: 'Electrical',
      year: '3rd Year',
      password: 'hash',
      role: Role.USER,
      isVerified: true,
    },
  });

  console.log('Stage 2: Topping up wallets...');
  await settingsService.seedDefaultSettings();
  await walletService.topup(bidder1.id, 2000);
  await walletService.topup(bidder2.id, 2000);

  console.log('Stage 3: Creating auction listing...');
  const auction = await auctionService.createAuction(seller.id, {
    title: 'Senior Move-out: 27-inch Gaming Monitor',
    description: '144Hz IPS display, 1ms response, HDMI cables included',
    category: 'ELECTRONICS',
    startingBid: 1000,
    minIncrement: 100,
    reservePrice: 1200,
    durationHours: 1,
    antiSnipingSeconds: 60,
  });

  if (auction.currentBid !== 1000 || auction.status !== AuctionStatus.ACTIVE) {
    throw new Error('Initial auction state invalid');
  }

  console.log('Stage 4: Bidder 1 placing initial bid ₹1000...');
  const bid1Result = await auctionService.placeBid(bidder1.id, auction.id, 1000);
  if (bid1Result.auction.currentBid !== 1000 || bid1Result.auction.currentBidderId !== bidder1.id) {
    throw new Error('Bid 1 was not recorded properly');
  }

  const bidder1WalletAfterBid1 = await walletService.getWallet(bidder1.id);
  if (bidder1WalletAfterBid1.escrowBalance !== 1000 || bidder1WalletAfterBid1.balance !== 1000) {
    throw new Error(`Bidder 1 escrow hold incorrect. Escrow: ${bidder1WalletAfterBid1.escrowBalance}, Balance: ${bidder1WalletAfterBid1.balance}`);
  }

  console.log('Stage 5: Bidder 2 placing outbid ₹1200...');
  const bid2Result = await auctionService.placeBid(bidder2.id, auction.id, 1200);
  if (bid2Result.auction.currentBid !== 1200 || bid2Result.auction.currentBidderId !== bidder2.id) {
    throw new Error('Bid 2 was not recorded properly');
  }

  const bidder2Wallet = await walletService.getWallet(bidder2.id);
  if (bidder2Wallet.escrowBalance !== 1200 || bidder2Wallet.balance !== 800) {
    throw new Error(`Bidder 2 escrow hold incorrect. Escrow: ${bidder2Wallet.escrowBalance}, Balance: ${bidder2Wallet.balance}`);
  }

  const bidder1WalletAfterOutbid = await walletService.getWallet(bidder1.id);
  if (bidder1WalletAfterOutbid.escrowBalance !== 0 || bidder1WalletAfterOutbid.balance !== 2000) {
    throw new Error(`Bidder 1 was not refunded immediately on outbid. Escrow: ${bidder1WalletAfterOutbid.escrowBalance}, Balance: ${bidder1WalletAfterOutbid.balance}`);
  }

  console.log('Stage 6: Testing anti-sniping extension in last 15 seconds...');
  const almostExpiredEndTime = new Date(Date.now() + 15 * 1000);
  await prisma.auction.update({
    where: { id: auction.id },
    data: { endTime: almostExpiredEndTime },
  });

  const bid3Result = await auctionService.placeBid(bidder1.id, auction.id, 1400);
  if (!bid3Result.isExtended || bid3Result.auction.status !== AuctionStatus.EXTENDED) {
    throw new Error('Anti-sniping extension did not trigger');
  }

  const newEndTimeMs = new Date(bid3Result.auction.endTime).getTime();
  if (newEndTimeMs < Date.now() + 50 * 1000) {
    throw new Error('Anti-sniping extension time delta insufficient');
  }

  console.log('Stage 7: Settle auction and create Order in escrow...');
  const pastEndTime = new Date(Date.now() - 5000);
  await prisma.auction.update({
    where: { id: auction.id },
    data: { endTime: pastEndTime },
  });

  const settledAuction = await auctionService.settleAuction(auction.id);
  if (!settledAuction || settledAuction.status !== AuctionStatus.ENDED || !settledAuction.orderId) {
    throw new Error('Auction settlement failed to create order');
  }

  const order = await prisma.order.findUnique({
    where: { id: settledAuction.orderId },
  });

  if (!order || order.status !== OrderStatus.ESCROW_HELD || !order.pickupOtp) {
    throw new Error('Auction order not created in ESCROW_HELD state with OTP');
  }

  console.log('Stage 8: Verifying OTP handover to complete transaction...');
  const verifiedOrder = await orderService.verifyHandoverWithOtp(
    seller.id,
    order.id,
    order.pickupOtp
  );

  if (verifiedOrder.status !== OrderStatus.COMPLETED) {
    throw new Error('Order was not completed via OTP handover');
  }

  const sellerWallet = await walletService.getWallet(seller.id);
  if (sellerWallet.balance <= 0) {
    throw new Error('Seller did not receive funds after OTP verification');
  }

  const finalProduct = await prisma.product.findUnique({
    where: { id: auction.productId },
  });

  if (finalProduct?.status !== ProductStatus.SOLD) {
    throw new Error('Product not marked as SOLD after auction completion');
  }

  console.log('--- ALL REAL-TIME AUCTION & BIDDING TESTS PASSED ---');
  console.log(JSON.stringify({
    auctionId: auction.id,
    item: auction.product.title,
    winningBid: 1400,
    winner: bidder1.name,
    orderNumber: order.orderNumber,
    pickupOtp: order.pickupOtp,
    sellerPayout: sellerWallet.balance,
  }, null, 2));

  await prisma.order.delete({ where: { id: order.id } });
  await prisma.bid.deleteMany({ where: { auctionId: auction.id } });
  await prisma.auction.delete({ where: { id: auction.id } });
  await prisma.product.delete({ where: { id: auction.productId } });
  await prisma.walletLedger.deleteMany({ where: { wallet: { userId: { in: [seller.id, bidder1.id, bidder2.id] } } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: [seller.id, bidder1.id, bidder2.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [seller.id, bidder1.id, bidder2.id] } } });
}

runAuctionTestSuite()
  .catch((err) => {
    console.error('Auction test suite failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
