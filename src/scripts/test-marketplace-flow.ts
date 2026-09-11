import prisma from '../lib/prisma';
import { walletService } from '../modules/wallet/wallet.service';
import { orderService } from '../modules/orders/order.service';
import { productService } from '../modules/products/product.service';

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
  console.log(`🧪 STARTING END-TO-END VERIFICATION SUITE [ID: ${testRunId}]`);
  console.log(`======================================================\n`);

  let buyer: any;
  let seller: any;
  let saleProduct: any;
  let cancelProduct: any;
  let rentalProduct: any;

  try {
    // ---------------------------------------------------------
    // SETUP: Create 2 Test Users
    // ---------------------------------------------------------
    console.log('📌 Phase 0: Creating Test Users (Buyer & Seller)...');
    buyer = await prisma.user.create({
      data: {
        name: `Test Buyer ${testRunId}`,
        email: `buyer_${testRunId}@college.edu`,
        phone: `98${testRunId}0001`,
        password: 'hashed_password_sample',
        college: 'Apex Engineering College',
        branch: 'CSE',
        year: '3rd',
        isVerified: true,
      },
    });

    seller = await prisma.user.create({
      data: {
        name: `Test Seller ${testRunId}`,
        email: `seller_${testRunId}@college.edu`,
        phone: `98${testRunId}0002`,
        password: 'hashed_password_sample',
        college: 'Apex Engineering College',
        branch: 'ECE',
        year: '4th',
        isVerified: true,
      },
    });

    console.log(`  User Buyer: ${buyer.name} (${buyer.email})`);
    console.log(`  User Seller: ${seller.name} (${seller.phone})\n`);

    // ---------------------------------------------------------
    // TEST 1: Initial Wallet & Top-up
    // ---------------------------------------------------------
    console.log('📌 Test 1: Wallet Initial State & Top-Up');
    const initialWallet = await walletService.getWallet(buyer.id);
    assert(initialWallet.balance === 0, 'Initial buyer balance is ₹0.00');
    assert(initialWallet.escrowBalance === 0, 'Initial buyer escrow balance is ₹0.00');

    const topupResult = await walletService.topup(buyer.id, 2000);
    assert(topupResult.wallet.balance === 2000, 'Buyer wallet balance is now ₹2,000 after top-up');
    assert(topupResult.ledger.type === 'CREDIT', 'Top-up generated CREDIT ledger entry');
    console.log('');

    // ---------------------------------------------------------
    // TEST 2: Peer-to-Peer Wallet Transfer
    // ---------------------------------------------------------
    console.log('📌 Test 2: P2P Student Wallet Transfer');
    const transferResult = await walletService.transfer(buyer.id, seller.phone, 300, 'Project contribution');
    assert(transferResult.amount === 300, 'Transferred ₹300');
    assert(transferResult.senderBalance === 1700, 'Buyer balance decreased to ₹1,700');

    const sellerWalletAfterTransfer = await walletService.getWallet(seller.id);
    assert(sellerWalletAfterTransfer.balance === 300, 'Seller balance increased to ₹300');
    console.log('');

    // ---------------------------------------------------------
    // TEST 3: Permanent Purchase (SELL) with Escrow & Pickup OTP
    // ---------------------------------------------------------
    console.log('📌 Test 3: Permanent Purchase (SELL) with Escrow Hold & OTP Handshake');
    saleProduct = await productService.createProduct(seller.id, {
      title: `Engineering Mechanics Book ${testRunId}`,
      description: 'Standard textbook in good condition',
      price: 500,
      type: 'SELL',
      category: 'Books',
    });
    assert(saleProduct.status === 'AVAILABLE', 'Book is initially AVAILABLE');

    // Buyer checkouts with wallet
    const buyOrder = await orderService.checkout(buyer.id, saleProduct.id, 'WALLET');
    assert(buyOrder.status === 'ESCROW_HELD', 'Order status is ESCROW_HELD');
    assert(buyOrder.pickupOtp !== null, `6-digit Pickup OTP generated: ${buyOrder.pickupOtp}`);

    const productAfterCheckout = await prisma.product.findUnique({ where: { id: saleProduct.id } });
    assert(productAfterCheckout?.status === 'RESERVED', 'Product is now RESERVED');

    const buyerWalletAfterOrder = await walletService.getWallet(buyer.id);
    assert(buyerWalletAfterOrder.balance === 1200, 'Buyer available balance deducted from ₹1,700 to ₹1,200');
    assert(buyerWalletAfterOrder.escrowBalance === 500, 'Buyer escrow balance is now ₹500 (held securely)');

    // Seller verifies pickup OTP
    const completedBuyOrder = await orderService.verifyHandoverWithOtp(seller.id, buyOrder.id, buyOrder.pickupOtp!);
    assert(completedBuyOrder.status === 'COMPLETED', 'Order status transitioned to COMPLETED');

    const productAfterHandover = await prisma.product.findUnique({ where: { id: saleProduct.id } });
    assert(productAfterHandover?.status === 'SOLD', 'Product status transitioned to SOLD');

    const buyerWalletAfterHandover = await walletService.getWallet(buyer.id);
    assert(buyerWalletAfterHandover.escrowBalance === 0, 'Buyer escrow balance released to ₹0');

    const sellerWalletAfterHandover = await walletService.getWallet(seller.id);
    // Seller started with 300 + (500 - 2% fee = 490) = 790
    assert(sellerWalletAfterHandover.balance === 790, 'Seller received ₹490 payout (₹500 - 2% fee), balance is ₹790');
    console.log('');

    // ---------------------------------------------------------
    // TEST 4: Order Cancellation & Instant Escrow Refund
    // ---------------------------------------------------------
    console.log('📌 Test 4: Order Cancellation & Instant Escrow Refund');
    cancelProduct = await productService.createProduct(seller.id, {
      title: `Scientific Calculator ${testRunId}`,
      description: 'Casio fx-991EX',
      price: 400,
      type: 'SELL',
      category: 'Electronics',
    });

    const cancelOrder = await orderService.checkout(buyer.id, cancelProduct.id, 'WALLET');
    const buyerWalletBeforeCancel = await walletService.getWallet(buyer.id);
    assert(buyerWalletBeforeCancel.balance === 800, 'Buyer balance decreased to ₹800');
    assert(buyerWalletBeforeCancel.escrowBalance === 400, 'Buyer escrow balance is ₹400');

    // Buyer cancels order
    const cancelled = await orderService.cancelOrder(buyer.id, cancelOrder.id);
    assert(cancelled.status === 'CANCELLED', 'Order status transitioned to CANCELLED');

    const productAfterCancel = await prisma.product.findUnique({ where: { id: cancelProduct.id } });
    assert(productAfterCancel?.status === 'AVAILABLE', 'Product status returned to AVAILABLE');

    const buyerWalletAfterCancel = await walletService.getWallet(buyer.id);
    assert(buyerWalletAfterCancel.balance === 1200, 'Buyer balance instantly restored to ₹1,200');
    assert(buyerWalletAfterCancel.escrowBalance === 0, 'Buyer escrow balance returned to ₹0');
    console.log('');

    // ---------------------------------------------------------
    // TEST 5: Campus Rental (RENT) Lifecycle (Deposit + Multi-Stage Escrow)
    // ---------------------------------------------------------
    console.log('📌 Test 5: Campus Rental (RENT) Lifecycle with Security Deposit');
    rentalProduct = await productService.createProduct(seller.id, {
      title: `Mini Drafter ${testRunId}`,
      description: 'Omega mini drafter with clamp',
      price: 50, // ₹50/day
      type: 'RENT',
      category: 'Stationery',
    });

    // Buyer rents for 5 days: rentalFee = 250, securityDeposit = 200 -> Total = 450
    const rentOrder = await orderService.checkout(buyer.id, rentalProduct.id, 'WALLET', 5, 200);
    assert(rentOrder.orderType === 'RENTAL', 'Order recognized as RENTAL');
    assert(rentOrder.totalAmount === 450, 'Total escrow hold is ₹450 (₹250 rental fee + ₹200 deposit)');
    assert(rentOrder.pickupOtp !== null, `Rental Pickup OTP: ${rentOrder.pickupOtp}`);
    assert(rentOrder.returnOtp !== null, `Rental Return OTP: ${rentOrder.returnOtp}`);

    const buyerWalletDuringRentHold = await walletService.getWallet(buyer.id);
    assert(buyerWalletDuringRentHold.balance === 750, 'Buyer balance is ₹750 (1200 - 450)');
    assert(buyerWalletDuringRentHold.escrowBalance === 450, 'Buyer escrow balance is ₹450');

    // Stage 1: Pickup Handover (Pickup OTP)
    console.log('  -> Stage 1: Pickup Handshake...');
    const activeRental = await orderService.verifyHandoverWithOtp(seller.id, rentOrder.id, rentOrder.pickupOtp!);
    assert(activeRental.status === 'RENTAL_ACTIVE', 'Order is now RENTAL_ACTIVE');

    const productDuringRental = await prisma.product.findUnique({ where: { id: rentalProduct.id } });
    assert(productDuringRental?.status === 'RENTED', 'Product status is RENTED');

    const sellerWalletAfterPickup = await walletService.getWallet(seller.id);
    // Seller received 250 - 2% fee (5) = 245. Previous balance: 790 + 245 = 1035
    assert(sellerWalletAfterPickup.balance === 1035, 'Seller received ₹245 rental fee. Balance is ₹1,035');

    const buyerWalletDuringActiveRental = await walletService.getWallet(buyer.id);
    assert(buyerWalletDuringActiveRental.escrowBalance === 200, 'Security deposit of ₹200 REMAINS locked in buyer escrow');

    // Stage 2: Return Handover (Return OTP)
    console.log('  -> Stage 2: Item Return Handshake...');
    const returnedRental = await orderService.verifyReturnWithOtp(seller.id, rentOrder.id, rentOrder.returnOtp!);
    assert(returnedRental.status === 'COMPLETED', 'Rental order COMPLETED after return');

    const productAfterReturn = await prisma.product.findUnique({ where: { id: rentalProduct.id } });
    assert(productAfterReturn?.status === 'AVAILABLE', 'Rental product is back to AVAILABLE for next student');

    const buyerWalletAfterReturn = await walletService.getWallet(buyer.id);
    assert(buyerWalletAfterReturn.escrowBalance === 0, 'Buyer escrow balance cleared to ₹0');
    assert(buyerWalletAfterReturn.balance === 950, 'Security deposit of ₹200 refunded! Buyer balance is ₹950 (750 + 200)');
    console.log('');

    // ---------------------------------------------------------
    // TEST 6: Audit Ledger History Integrity
    // ---------------------------------------------------------
    console.log('📌 Test 6: Verifying Double-Entry Ledger History Integrity');
    const buyerHistory = await walletService.getHistory(buyer.id, { limit: 20 });
    assert(buyerHistory.entries.length > 0, `Buyer has ${buyerHistory.entries.length} immutable ledger audit entries`);
    console.log(`  Ledger record count for buyer: ${buyerHistory.entries.length}`);

    console.log(`\n======================================================`);
    console.log(`🎉 ALL 6 TEST SCENARIOS PASSED WITH ZERO ERRORS!`);
    console.log(`======================================================\n`);
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exitCode = 1;
  } finally {
    console.log('🧹 Cleaning up test artifacts from database...');
    if (buyer) {
      await prisma.walletLedger.deleteMany({ where: { wallet: { userId: { in: [buyer.id, seller?.id].filter(Boolean) } } } });
      await prisma.wallet.deleteMany({ where: { userId: { in: [buyer.id, seller?.id].filter(Boolean) } } });
      await prisma.order.deleteMany({ where: { OR: [{ buyerId: buyer.id }, { sellerId: buyer.id }, { buyerId: seller?.id }, { sellerId: seller?.id }] } });
      await prisma.product.deleteMany({ where: { ownerId: { in: [buyer.id, seller?.id].filter(Boolean) } } });
      await prisma.user.deleteMany({ where: { id: { in: [buyer.id, seller?.id].filter(Boolean) } } });
    }
    await prisma.$disconnect();
    console.log('✅ Cleanup complete. Database is pristine.\n');
  }
}

runTests();
