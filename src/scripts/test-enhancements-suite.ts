import http from 'http';
import jwt from 'jsonwebtoken';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import prisma from '../lib/prisma';
import app from '../app';
import { initSocket } from '../lib/socket';
import { env } from '../config/env';
import { walletService } from '../modules/wallet/wallet.service';
import { productService } from '../modules/products/product.service';
import { orderService } from '../modules/orders/order.service';
import { adminService } from '../modules/admin/admin.service';

const testRunId = Date.now().toString().slice(-6);

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ ${message}`);
}

async function runTests() {
  console.log(`\n======================================================`);
  console.log(`🧪 COMPREHENSIVE SUITE: SOCKET.IO, CHAT, MODERATION, DISPUTES [ID: ${testRunId}]`);
  console.log(`======================================================\n`);

  const server = http.createServer(app);
  initSocket(server);

  const TEST_PORT = 5055;
  await new Promise<void>((resolve) => server.listen(TEST_PORT, () => resolve()));
  console.log(`🚀 Live test server running on port ${TEST_PORT}\n`);

  let buyer: any;
  let seller: any;
  let admin: any;
  let buyerSocket: ClientSocket | null = null;
  let sellerSocket: ClientSocket | null = null;

  try {
    // ---------------------------------------------------------
    // Phase 0: Setup Test Users & Admin
    // ---------------------------------------------------------
    console.log('📌 Phase 0: Creating Buyer, Seller, and Admin...');
    buyer = await prisma.user.create({
      data: {
        name: `Buyer_${testRunId}`,
        email: `buyer_${testRunId}@college.edu`,
        phone: `98${testRunId}01`,
        password: 'hashed_sample',
        college: 'MIT College of Engg',
        branch: 'CSE',
        year: '3rd',
        isVerified: true,
      },
    });

    seller = await prisma.user.create({
      data: {
        name: `Seller_${testRunId}`,
        email: `seller_${testRunId}@college.edu`,
        phone: `98${testRunId}02`,
        password: 'hashed_sample',
        college: 'MIT College of Engg',
        branch: 'ECE',
        year: '4th',
        isVerified: true,
      },
    });

    admin = await prisma.user.create({
      data: {
        name: `Admin_${testRunId}`,
        email: `admin_${testRunId}@college.edu`,
        phone: `98${testRunId}03`,
        password: 'hashed_sample',
        college: 'MIT College of Engg',
        branch: 'ADMIN',
        year: 'Staff',
        role: 'ADMIN',
        isVerified: true,
      },
    });

    const buyerToken = jwt.sign({ userId: buyer.id }, env.JWT_LOGIN_SECRET);
    const sellerToken = jwt.sign({ userId: seller.id }, env.JWT_LOGIN_SECRET);

    console.log(`  Buyer: ${buyer.name} | Seller: ${seller.name} | Admin: ${admin.name}`);

    // ---------------------------------------------------------
    // Phase 1: Real-time Socket.io Gateway & Product Contextual Chat
    // ---------------------------------------------------------
    console.log('\n📌 Phase 1: Testing Socket.io Handshake & Product-Contextual Chat...');

    const chatProduct = await productService.createProduct(seller.id, {
      title: `Casio Calculator FX-991 [${testRunId}]`,
      description: 'Used scientific calculator for semester exams',
      price: 600,
      type: 'SELL',
      category: 'Electronics',
    });

    buyerSocket = Client(`http://localhost:${TEST_PORT}`, {
      auth: { token: buyerToken },
      transports: ['websocket'],
    });

    sellerSocket = Client(`http://localhost:${TEST_PORT}`, {
      auth: { token: sellerToken },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise<void>((resolve) => buyerSocket!.on('connect', () => resolve())),
      new Promise<void>((resolve) => sellerSocket!.on('connect', () => resolve())),
    ]);
    assert(buyerSocket.connected && sellerSocket.connected, 'Both Buyer and Seller connected via WebSocket');

    const messagePromise = new Promise<any>((resolve) => {
      sellerSocket!.on('receive_message', (payload) => {
        resolve(payload);
      });
    });

    buyerSocket.emit('send_message', {
      toUserId: seller.id,
      content: 'Hey, is the calculator still available? Can we meet at library?',
      productId: chatProduct.id,
    });

    const receivedMessage = await messagePromise;
    assert(receivedMessage.content.includes('calculator'), 'Seller received message content in real time');
    assert(receivedMessage.productId === chatProduct.id, 'Message is linked to the specific product ID');
    assert(receivedMessage.product?.title === chatProduct.title, 'Message includes rich product preview data');

    const typingPromise = new Promise<any>((resolve) => {
      sellerSocket!.on('user_typing', (payload) => {
        resolve(payload);
      });
    });

    buyerSocket.emit('typing', { toUserId: seller.id, isTyping: true });
    const typingPayload = await typingPromise;
    assert(typingPayload.fromUserId === buyer.id && typingPayload.isTyping === true, 'Real-time typing indicator delivered');

    // ---------------------------------------------------------
    // Phase 2: Smart Moderation & Student Reporting
    // ---------------------------------------------------------
    console.log('\n📌 Phase 2: Testing Automated Content Moderation & Reporting...');

    const prohibitedListing = await productService.createProduct(seller.id, {
      title: `Exam Cheat Code and Leaked Paper [${testRunId}]`,
      description: 'Guaranteed questions for upcoming finals, pirated software keys included',
      price: 1500,
      type: 'SELL',
      category: 'Academics',
    });

    assert(prohibitedListing.isFlagged === true, 'Prohibited keywords ("cheat code", "leaked paper") automatically set isFlagged: true');

    const availableProducts = await productService.getAllAvailable();
    const isLeakedProductVisible = availableProducts.some((p) => p.id === prohibitedListing.id);
    assert(!isLeakedProductVisible, 'Flagged product is automatically excluded from public marketplace listings');

    const legitProduct = await productService.createProduct(seller.id, {
      title: `Engineering Physics Textbook [${testRunId}]`,
      description: 'Halliday Resnick 10th edition in good condition',
      price: 450,
      type: 'SELL',
      category: 'Books',
    });

    const report = await productService.reportProduct(
      buyer.id,
      legitProduct.id,
      'Suspected fake copyright copy',
      'The pages appear photocopied rather than original print'
    );
    assert(report.status === 'PENDING', 'Product report recorded in PENDING state');

    const adminReports = await adminService.getReports(admin.id, 1, 10, 'PENDING');
    const hasReport = adminReports.reports.some((r: any) => r.id === report.id);
    assert(hasReport, 'Admin can view reported items in the moderation queue');

    const actionResult = await adminService.handleReportAction(admin.id, report.id, 'FLAG_PRODUCT');
    assert(actionResult.report?.status === 'RESOLVED', 'Admin report status marked as RESOLVED');

    const updatedLegitProduct = await productService.getProductById(legitProduct.id);
    assert(updatedLegitProduct.isFlagged === true, 'Admin action successfully updated product flag');

    // ---------------------------------------------------------
    // Phase 3: Escrow Dispute Resolution & Admin Arbitration
    // ---------------------------------------------------------
    console.log('\n📌 Phase 3: Testing Escrow Dispute Resolution (REFUND_BUYER & RELEASE_SELLER)...');

    await walletService.topup(buyer.id, 5000);

    const disputeProduct = await productService.createProduct(seller.id, {
      title: `Arduino Mega Starter Kit [${testRunId}]`,
      description: 'Microcontroller with 40 sensor modules',
      price: 1200,
      type: 'SELL',
      category: 'Electronics',
    });

    const order1 = await orderService.checkout(buyer.id, disputeProduct.id, 'WALLET');
    assert(order1.status === 'ESCROW_HELD', 'Order placed with escrow hold in buyer wallet');

    const disputedOrder = await orderService.raiseDispute(
      buyer.id,
      order1.id,
      'Seller gave incomplete kit - 20 sensors are missing from box'
    );
    assert(disputedOrder.status === 'DISPUTED', 'Order transitioned to DISPUTED status');
    assert(disputedOrder.disputeReason!.includes('incomplete kit'), 'Dispute reason logged');

    const adminDisputes = await adminService.getDisputes(admin.id, 1, 10);
    const foundDispute = adminDisputes.disputes.some((d: any) => d.id === order1.id);
    assert(foundDispute, 'Admin can inspect active disputes');

    // Case A: REFUND_BUYER
    const buyerWalletBeforeRefund = await walletService.getWallet(buyer.id);
    const resolvedOrderRefund = await adminService.resolveDispute(
      admin.id,
      order1.id,
      'REFUND_BUYER',
      'Buyer provided photo evidence of missing parts. Refunding escrow.'
    );
    assert(resolvedOrderRefund.status === 'REFUNDED', 'Order status set to REFUNDED');

    const buyerWalletAfterRefund = await walletService.getWallet(buyer.id);
    assert(
      buyerWalletAfterRefund.balance === buyerWalletBeforeRefund.balance + order1.totalAmount,
      'Buyer wallet balance credited back full escrow amount (₹1200)'
    );

    const restoredProduct = await productService.getProductById(disputeProduct.id);
    assert(restoredProduct.status === 'AVAILABLE', 'Product status restored to AVAILABLE');

    // Case B: RELEASE_SELLER
    console.log('\n  -- Testing Dispute Case B: Admin resolves with RELEASE_SELLER --');
    const order2 = await orderService.checkout(buyer.id, disputeProduct.id, 'WALLET');
    await orderService.raiseDispute(
      seller.id,
      order2.id,
      'Buyer received item in person but claims did not get OTP'
    );

    const sellerWalletBeforeRelease = await walletService.getWallet(seller.id);
    const resolvedOrderRelease = await adminService.resolveDispute(
      admin.id,
      order2.id,
      'RELEASE_SELLER',
      'Verified CCTV footage of handover at campus cafeteria. Releasing payment to seller.'
    );
    assert(resolvedOrderRelease.status === 'COMPLETED', 'Order status set to COMPLETED');

    const expectedPayout = order2.totalAmount - order2.platformFee;
    const sellerWalletAfterRelease = await walletService.getWallet(seller.id);
    assert(
      sellerWalletAfterRelease.balance === sellerWalletBeforeRelease.balance + expectedPayout,
      `Seller received full payout minus 2% platform fee (credited ₹${expectedPayout})`
    );

    const soldProduct = await productService.getProductById(disputeProduct.id);
    assert(soldProduct.status === 'SOLD', 'Product status correctly updated to SOLD');

    console.log(`\n======================================================`);
    console.log(`🎉 ALL 4 SYSTEM ENHANCEMENTS VERIFIED SUCCESSFULLY!`);
    console.log(`======================================================\n`);
  } finally {
    if (buyerSocket) buyerSocket.disconnect();
    if (sellerSocket) sellerSocket.disconnect();
    server.close();
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('❌ Test suite execution failed:', err);
  process.exit(1);
});
