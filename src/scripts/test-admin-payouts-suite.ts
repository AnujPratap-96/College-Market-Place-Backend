import prisma from '../lib/prisma';
import { settingsService } from '../modules/admin/settings.service';
import { adminService } from '../modules/admin/admin.service';
import { orderService } from '../modules/orders/order.service';
import { walletService } from '../modules/wallet/wallet.service';
import { ProductType, OrderStatus, Role } from '@prisma/client';

async function runAdminAndPayoutsSuite() {
  const timestamp = Date.now();

  const adminUser = await prisma.user.upsert({
    where: { email: `admin_${timestamp}@test.edu` },
    update: {},
    create: {
      name: 'Campus SuperAdmin',
      email: `admin_${timestamp}@test.edu`,
      phone: `99${timestamp.toString().slice(-8)}`,
      college: 'IIT Delhi',
      branch: 'Administration',
      year: 'Faculty',
      password: 'hash',
      role: Role.ADMIN,
      isVerified: true,
    },
  });

  const studentA = await prisma.user.upsert({
    where: { email: `student_buyer_${timestamp}@test.edu` },
    update: {},
    create: {
      name: 'Buyer Student',
      email: `student_buyer_${timestamp}@test.edu`,
      phone: `98${timestamp.toString().slice(-8)}`,
      college: 'IIT Delhi',
      branch: 'Computer Science',
      year: '3rd Year',
      password: 'hash',
      role: Role.USER,
      isVerified: true,
    },
  });

  const studentB = await prisma.user.upsert({
    where: { email: `student_provider_${timestamp}@test.edu` },
    update: {},
    create: {
      name: 'Provider Student',
      email: `student_provider_${timestamp}@test.edu`,
      phone: `97${timestamp.toString().slice(-8)}`,
      college: 'IIT Delhi',
      branch: 'Electrical',
      year: '4th Year',
      password: 'hash',
      role: Role.USER,
      isVerified: true,
    },
  });

  await settingsService.seedDefaultSettings();
  await settingsService.updateSettings({
    platform_commission_percent: '0',
    min_withdrawal_amount: '50',
    payout_gateway_mode: 'SANDBOX',
  });

  const settings0 = await settingsService.getAllSettings();
  if (settings0.platform_commission_percent !== '0') {
    throw new Error(`Failed to set 0% commission: got ${settings0.platform_commission_percent}`);
  }

  const serviceProduct = await prisma.product.create({
    data: {
      title: 'Bike Repair Service',
      description: 'Tune up and puncture fix',
      price: 200,
      type: ProductType.SERVICE,
      category: 'Campus Services',
      ownerId: studentB.id,
      serviceDuration: '1 hour',
    },
  });

  await walletService.topup(studentA.id, 1000);

  const order0Percent = await orderService.bookService(studentA.id, serviceProduct.id, 'Tomorrow 5 PM', 'Check tire pressure');
  if (order0Percent.platformFee !== 0) {
    throw new Error(`Expected ₹0 platform fee at 0% commission, got: ₹${order0Percent.platformFee}`);
  }

  await adminService.updateSystemSettings(adminUser.id, {
    platform_commission_percent: '3.5',
  });

  const order3Point5Percent = await orderService.bookService(studentA.id, serviceProduct.id, 'Day after 2 PM', 'Brake adjustment');
  const expectedFee = Number((200 * 0.035).toFixed(2));
  if (order3Point5Percent.platformFee !== expectedFee) {
    throw new Error(`Expected ₹${expectedFee} platform fee at 3.5% commission, got: ₹${order3Point5Percent.platformFee}`);
  }

  await walletService.topup(studentB.id, 500);

  let failedMinWithdrawal = false;
  try {
    await walletService.withdraw(studentB.id, 'studentb@upi', 20);
  } catch (err: any) {
    if (err.message.includes('Minimum withdrawal amount is ₹50')) {
      failedMinWithdrawal = true;
    }
  }
  if (!failedMinWithdrawal) {
    throw new Error('Withdrawal below minimum limit should have been rejected');
  }

  let failedInvalidUpi = false;
  try {
    await walletService.withdraw(studentB.id, 'invalid-vpa-address', 100);
  } catch (err: any) {
    if (err.message.includes('Invalid UPI ID format')) {
      failedInvalidUpi = true;
    }
  }
  if (!failedInvalidUpi) {
    throw new Error('Withdrawal with invalid UPI address format should have been rejected');
  }

  const withdrawalResult = await walletService.withdraw(studentB.id, 'studentb@okhdfcbank', 150);
  if (withdrawalResult.status !== 'PROCESSED' || withdrawalResult.wallet.balance !== 350) {
    throw new Error(`Withdrawal execution failed: balance is ${withdrawalResult.wallet.balance}, expected 350`);
  }

  const bLedger = await walletService.getHistory(studentB.id, { limit: 5 });
  const withdrawalEntry = bLedger.entries.find((e) => e.referenceType === 'WITHDRAWAL');
  if (!withdrawalEntry || withdrawalEntry.amount !== 150) {
    throw new Error('Ledger did not record WITHDRAWAL entry for student B');
  }

  const paymentOrder = await walletService.createPaymentOrder(studentA.id, 250);
  if (!paymentOrder.orderId || paymentOrder.amount !== 25000) {
    throw new Error('Payment order creation failed');
  }

  const verifyResult = await walletService.verifyPayment(
    studentA.id,
    paymentOrder.orderId,
    `pay_${Date.now()}`,
    undefined,
    250
  );
  if (!verifyResult.wallet) {
    throw new Error('Gateway payment verification topup failed');
  }

  const disputeOrder = await prisma.order.update({
    where: { id: order3Point5Percent.id },
    data: {
      status: OrderStatus.DISPUTED,
      disputeReason: 'Provider did not show up',
      disputedAt: new Date(),
    },
  });

  const disputesList = await adminService.getDisputes(adminUser.id, 1, 10);
  const foundInDisputes = disputesList.disputes.some((d) => d.id === disputeOrder.id);
  if (!foundInDisputes) {
    throw new Error('Disputed order was not listed in admin dispute queue');
  }

  const resolvedOrder = await adminService.resolveDispute(
    adminUser.id,
    disputeOrder.id,
    'REFUND_BUYER',
    'Provider confirmed no-show. Instant refund authorized.'
  );
  if (resolvedOrder.status !== OrderStatus.REFUNDED) {
    throw new Error(`Expected status REFUNDED after dispute resolution, got: ${resolvedOrder.status}`);
  }

  const financialStats = await adminService.getFinancialStats(adminUser.id);
  if (financialStats.activeDisputesCount !== 0) {
    throw new Error(`Expected 0 active disputes after resolution, got ${financialStats.activeDisputesCount}`);
  }

  await prisma.walletLedger.deleteMany({
    where: {
      wallet: {
        userId: { in: [studentA.id, studentB.id, adminUser.id] },
      },
    },
  });
  await prisma.order.deleteMany({
    where: { id: { in: [order0Percent.id, order3Point5Percent.id] } },
  });
  await prisma.product.deleteMany({
    where: { id: serviceProduct.id },
  });
  await prisma.wallet.deleteMany({
    where: { userId: { in: [studentA.id, studentB.id, adminUser.id] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [studentA.id, studentB.id, adminUser.id] } },
  });

  console.log('SUCCESS: All Admin Control Center, Dynamic Commission, and Payout Sandbox tests PASSED perfectly!');
}

runAdminAndPayoutsSuite()
  .catch((err) => {
    console.error('TEST SUITE FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
