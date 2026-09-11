import prisma from '../lib/prisma';
import { walletService } from '../modules/wallet/wallet.service';
import { productService } from '../modules/products/product.service';
import { orderService } from '../modules/orders/order.service';
import { subscriptionService } from '../modules/subscriptions/subscription.service';
import { ProductType, SubscriptionFrequency, DeliveryScheduleStatus } from '@prisma/client';

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
  console.log(`🧪 STARTING CAMPUS SERVICES & SUBSCRIPTIONS SUITE [ID: ${testRunId}]`);
  console.log(`======================================================\n`);

  let clientUser: any;
  let providerUser: any;
  let serviceListing: any;
  let subscriptionListing: any;
  let serviceOrder: any;
  let activeSubscription: any;

  try {
    // ---------------------------------------------------------
    // Phase 0: Create Test Users
    // ---------------------------------------------------------
    console.log('📌 Phase 0: Creating Client & Service Provider...');
    clientUser = await prisma.user.create({
      data: {
        name: `Student Client ${testRunId}`,
        email: `client_${testRunId}@college.edu`,
        phone: `91${testRunId}01`,
        password: 'hashed_password_sample',
        college: 'National Institute of Technology',
        branch: 'Mechanical',
        year: '2nd',
        isVerified: true,
      },
    });

    providerUser = await prisma.user.create({
      data: {
        name: `Campus Provider ${testRunId}`,
        email: `provider_${testRunId}@college.edu`,
        phone: `91${testRunId}02`,
        password: 'hashed_password_sample',
        college: 'National Institute of Technology',
        branch: 'Computer Science',
        year: 'Final',
        isVerified: true,
      },
    });

    console.log(`  Client: ${clientUser.name} (${clientUser.email})`);
    console.log(`  Provider: ${providerUser.name} (${providerUser.phone})\n`);

    // ---------------------------------------------------------
    // Phase 1: One-Time Service Flow (SERVICE)
    // ---------------------------------------------------------
    console.log('📌 Phase 1: Testing One-Time Service Flow (Escrow, Complete, Confirm)...');

    serviceListing = await productService.createProduct(providerUser.id, {
      title: `PC Formatting & Deep Cleaning [${testRunId}]`,
      description: 'Complete OS reinstallation, thermal paste replacement, and internal dust cleaning',
      price: 400,
      type: ProductType.SERVICE,
      category: 'Tech Services',
    });
    assert(serviceListing.type === 'SERVICE', 'Product created with type: SERVICE');

    await walletService.topup(clientUser.id, 2000);
    const clientWalletBefore = await walletService.getWallet(clientUser.id);
    assert(clientWalletBefore.balance === 2000, 'Client topped up wallet to ₹2,000');

    // Book service
    serviceOrder = await orderService.bookService(
      clientUser.id,
      serviceListing.id,
      'Saturday 4:00 PM',
      'Please bring bootable USB for Windows 11'
    );
    assert(serviceOrder.orderType === 'SERVICE', 'Order created with orderType: SERVICE');
    assert(serviceOrder.status === 'ESCROW_HELD', 'Service fee held securely in escrow');

    const clientWalletAfterBooking = await walletService.getWallet(clientUser.id);
    assert(clientWalletAfterBooking.balance === 1600, 'Client available balance deducted by ₹400 (now ₹1,600)');
    assert(clientWalletAfterBooking.escrowBalance === 400, 'Client escrow balance is ₹400');

    // Provider marks completed
    const completedByProvider = await orderService.completeService(providerUser.id, serviceOrder.id);
    assert(completedByProvider.status === 'DELIVERED', 'Service order status updated to DELIVERED');

    // Client confirms satisfactory completion
    const confirmedOrder = await orderService.confirmService(clientUser.id, serviceOrder.id);
    assert(confirmedOrder.status === 'COMPLETED', 'Service order finalized to COMPLETED');

    const clientWalletFinal = await walletService.getWallet(clientUser.id);
    assert(clientWalletFinal.escrowBalance === 0, 'Client escrow balance cleared to ₹0');

    const expectedProviderPayout = 400 - Number((400 * 0.02).toFixed(2)); // ₹392
    const providerWalletFinal = await walletService.getWallet(providerUser.id);
    assert(
      providerWalletFinal.balance === expectedProviderPayout,
      `Provider credited ₹${expectedProviderPayout} (₹400 minus 2% platform fee)`
    );

    // ---------------------------------------------------------
    // Phase 2: Campus Subscription Creation & Delivery Scheduling
    // ---------------------------------------------------------
    console.log('\n📌 Phase 2: Testing Recurring Subscription Booking & Schedule Generation...');

    subscriptionListing = await productService.createProduct(providerUser.id, {
      title: `Hostel Pure Veg Dinner Tiffin [${testRunId}]`,
      description: 'Daily hot dinner (4 rotis, paneer sabzi, dal, rice, salad) delivered to hostel gate',
      price: 3000,
      type: ProductType.SUBSCRIPTION,
      category: 'Food & Mess',
    });
    assert(subscriptionListing.type === 'SUBSCRIPTION', 'Product created with type: SUBSCRIPTION');

    await walletService.topup(clientUser.id, 5000); // balance becomes 1600 + 5000 = 6600

    activeSubscription = await subscriptionService.subscribe(clientUser.id, {
      productId: subscriptionListing.id,
      frequency: SubscriptionFrequency.MONTHLY,
      deliverySlots: '8:00 PM - 9:00 PM at Hostel Block B',
      autoRenew: false,
    });

    assert(activeSubscription.status === 'ACTIVE', 'Subscription created in ACTIVE state');
    assert(activeSubscription.deliveries.length === 30, 'Generated 30 daily scheduled deliveries on calendar');

    const clientWalletSubHold = await walletService.getWallet(clientUser.id);
    assert(clientWalletSubHold.escrowBalance === 3000, 'Cycle fee of ₹3,000 locked in wallet escrow');

    // Provider checks delivery manifest
    const manifest = await subscriptionService.getProviderManifest(providerUser.id);
    assert(manifest.activeSubscribersCount >= 1, 'Provider manifest reflects active subscriber');

    // ---------------------------------------------------------
    // Phase 3: Vacation / Pause Mode & Automated Pro-Rata Refund
    // ---------------------------------------------------------
    console.log('\n📌 Phase 3: Testing Vacation Mode & Instant Pro-Rata Refund...');

    // Student goes home for 4 days (days 5 to 8 of the subscription)
    const startDate = new Date(activeSubscription.startDate);
    const vacationFrom = new Date(startDate.getTime() + 4.5 * 24 * 60 * 60 * 1000); // after day 4
    const vacationTo = new Date(startDate.getTime() + 8.5 * 24 * 60 * 60 * 1000);   // after day 8

    const balanceBeforeVacation = (await walletService.getWallet(clientUser.id)).balance;
    const vacationResult = await subscriptionService.setVacation(
      clientUser.id,
      activeSubscription.id,
      vacationFrom.toISOString(),
      vacationTo.toISOString()
    );

    assert(vacationResult.pausedDaysCount === 4, 'Successfully paused 4 scheduled delivery days');
    assert(vacationResult.refundedAmount === 400, 'Pro-rata refund calculated at ₹100/day = ₹400');

    const balanceAfterVacation = (await walletService.getWallet(clientUser.id)).balance;
    assert(
      balanceAfterVacation === balanceBeforeVacation + 400,
      'Pro-rata refund of ₹400 instantly credited back to student wallet balance!'
    );

    // ---------------------------------------------------------
    // Phase 4: Missed Delivery Reporting
    // ---------------------------------------------------------
    console.log('\n📌 Phase 4: Testing Missed Delivery Reporting...');

    // Student reports day 2 delivery missed
    const targetDelivery = activeSubscription.deliveries[1]; // day 2
    const missedResult = await subscriptionService.reportMissedDelivery(
      clientUser.id,
      activeSubscription.id,
      targetDelivery.id,
      'Tiffin was not delivered at hostel gate'
    );

    assert(missedResult.refundedAmount === 100, 'Daily rate of ₹100 refunded for missed delivery');

    const balanceAfterMissed = (await walletService.getWallet(clientUser.id)).balance;
    assert(
      balanceAfterMissed === balanceAfterVacation + 100,
      'Student wallet credited ₹100 for reported missed delivery!'
    );

    // ---------------------------------------------------------
    // Phase 5: Cycle Settlement & Provider Payout
    // ---------------------------------------------------------
    console.log('\n📌 Phase 5: Testing Cycle Settlement & Provider Payout...');

    // Set endDate to past to trigger settlement
    await prisma.subscription.update({
      where: { id: activeSubscription.id },
      data: { endDate: new Date(Date.now() - 1000) },
    });

    const providerWalletBeforeSettle = await walletService.getWallet(providerUser.id);
    const settleResult = await subscriptionService.settleEndedCycles();

    assert(settleResult.settledCount >= 1, 'Ended subscription cycle settled');

    // 30 days total: 4 skipped (vacation) + 1 missed = 25 served
    // Net escrow: 25 * 100 = ₹2,500
    // Platform fee (2%): ₹50
    // Net provider payout: ₹2,450
    const expectedSettlePayout = 2500 - 50;
    const providerWalletAfterSettle = await walletService.getWallet(providerUser.id);
    assert(
      providerWalletAfterSettle.balance === providerWalletBeforeSettle.balance + expectedSettlePayout,
      `Provider received net cycle payout of ₹${expectedSettlePayout} (25 delivered days minus 2% fee)`
    );

    const clientWalletEnd = await walletService.getWallet(clientUser.id);
    assert(clientWalletEnd.escrowBalance === 0, 'Client escrow balance fully resolved to ₹0');

    // Verify double-entry ledger records
    const clientHistory = await walletService.getHistory(clientUser.id, { limit: 20 });
    const hasVacationRefund = clientHistory.entries.some((e: any) => e.referenceType === 'SUBSCRIPTION_VACATION_REFUND');
    const hasMissedRefund = clientHistory.entries.some((e: any) => e.referenceType === 'SUBSCRIPTION_MISSED_REFUND');
    assert(hasVacationRefund, 'Immutable ledger has SUBSCRIPTION_VACATION_REFUND entry');
    assert(hasMissedRefund, 'Immutable ledger has SUBSCRIPTION_MISSED_REFUND entry');

    console.log(`\n======================================================`);
    console.log(`🎉 ALL CAMPUS SERVICES & SUBSCRIPTION TESTS PASSED!`);
    console.log(`======================================================\n`);
  } finally {
    console.log('🧹 Cleaning up test users and listings...');
    if (activeSubscription?.id) {
      await prisma.subscriptionDelivery.deleteMany({ where: { subscriptionId: activeSubscription.id } }).catch(() => {});
      await prisma.subscription.deleteMany({ where: { id: activeSubscription.id } }).catch(() => {});
    }
    if (serviceOrder?.id) {
      await prisma.order.deleteMany({ where: { id: serviceOrder.id } }).catch(() => {});
    }
    if (serviceListing?.id) {
      await prisma.product.deleteMany({ where: { id: serviceListing.id } }).catch(() => {});
    }
    if (subscriptionListing?.id) {
      await prisma.product.deleteMany({ where: { id: subscriptionListing.id } }).catch(() => {});
    }
    if (clientUser?.id) {
      await prisma.walletLedger.deleteMany({ where: { wallet: { userId: clientUser.id } } }).catch(() => {});
      await prisma.wallet.deleteMany({ where: { userId: clientUser.id } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: clientUser.id } }).catch(() => {});
    }
    if (providerUser?.id) {
      await prisma.walletLedger.deleteMany({ where: { wallet: { userId: providerUser.id } } }).catch(() => {});
      await prisma.wallet.deleteMany({ where: { userId: providerUser.id } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: providerUser.id } }).catch(() => {});
    }
    await prisma.$disconnect();
    console.log('✅ Cleanup complete. Database is pristine.\n');
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
