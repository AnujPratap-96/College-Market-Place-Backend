# Campus Services & Recurring Subscription Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement one-time campus services (`SERVICE`) and recurring subscription deliveries (`SUBSCRIPTION`) with automated wallet escrow, vacation pauses, instant pro-rata refunds, and cycle settlement.

**Architecture:** Extend Prisma schema with `Subscription` and `SubscriptionDelivery` models; implement double-entry wallet ledger accounting for subscription holds, vacation refunds, and cycle payouts; build `src/modules/subscriptions/` following the strict `req -> route -> validation -> controller -> service -> repository -> response` structure.

**Tech Stack:** Node.js, Express, TypeScript, Prisma ORM, PostgreSQL (Supabase), Zod, Socket.io.

---

### Task 1: Prisma Schema & Database Synchronization

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update Prisma schema**
  - Add `SERVICE` and `SUBSCRIPTION` to `ProductType`.
  - Add `SERVICE` to `OrderType`.
  - Add enums: `SubscriptionStatus`, `SubscriptionFrequency`, `DeliveryScheduleStatus`.
  - Add fields to `Product`: `frequency`, `deliverySlots`, `serviceDuration`.
  - Add `Subscription` and `SubscriptionDelivery` models.
  - Add relation fields on `User` for `UserSubscriptions` and `ProviderSubscriptions`.

- [ ] **Step 2: Push database changes & generate client**
  Run: `npx prisma db push && npx prisma generate`
  Expected: Success with `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Verify TypeScript compilation**
  Run: `npm run build`
  Expected: Exit code 0.

---

### Task 2: Wallet Service Extensions for Subscriptions

**Files:**
- Modify: `src/modules/wallet/wallet.service.ts`

- [ ] **Step 1: Add subscription escrow hold method**
  - Implement `holdSubscriptionEscrow(subscriberId, amount, subscriptionId, tx)` with `HOLD` ledger entry.

- [ ] **Step 2: Add subscription pro-rata vacation refund method**
  - Implement `refundSubscriptionVacation(subscriberId, amount, subscriptionId, daysCount, tx)` with `REFUND` ledger entry.

- [ ] **Step 3: Add subscription cycle settlement method**
  - Implement `settleSubscriptionCycle(subscriberId, providerId, payoutAmount, platformFee, subscriptionId, tx)` with `RELEASE` and `CREDIT` ledger entries.

- [ ] **Step 4: Verify TypeScript compilation**
  Run: `npm run build`
  Expected: Exit code 0.

---

### Task 3: One-Time Service Flow in Orders Module

**Files:**
- Modify: `src/modules/orders/order.schema.ts`
- Modify: `src/modules/orders/order.service.ts`
- Modify: `src/modules/orders/order.controller.ts`
- Modify: `src/modules/orders/order.routes.ts`

- [ ] **Step 1: Update order schemas**
  - Add `bookServiceSchema` with `productId`, `preferredTime`, `notes`.
  - Update `createProductSchema` in `product.schema.ts` to accept `SERVICE` and `SUBSCRIPTION`.

- [ ] **Step 2: Add service fulfillment methods in `order.service.ts`**
  - Implement `bookService(buyerId, productId, notes)`.
  - Implement `completeService(providerId, orderId)`.
  - Implement `confirmService(buyerId, orderId)`.

- [ ] **Step 3: Wire controller and routes**
  - Add `POST /api/orders/service-book`.
  - Add `POST /api/orders/:id/service-complete`.
  - Add `POST /api/orders/:id/service-confirm`.

- [ ] **Step 4: Verify TypeScript compilation**
  Run: `npm run build`
  Expected: Exit code 0.

---

### Task 4: Subscriptions Module Implementation

**Files:**
- Create: `src/modules/subscriptions/subscription.schema.ts`
- Create: `src/modules/subscriptions/subscription.repository.ts`
- Create: `src/modules/subscriptions/subscription.service.ts`
- Create: `src/modules/subscriptions/subscription.controller.ts`
- Create: `src/modules/subscriptions/subscription.routes.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Create `subscription.schema.ts`**
  - Define Zod schemas: `subscribeSchema`, `vacationSchema`, `reportMissedSchema`, `subscriptionIdParamSchema`.

- [ ] **Step 2: Create `subscription.repository.ts`**
  - Implement `createWithDeliveries`, `findById`, `findBySubscriber`, `findByProvider`, `update`, `findDeliveries`, `updateDeliveryStatus`, `findEndedCycles`.

- [ ] **Step 3: Create `subscription.service.ts`**
  - Implement `subscribe(subscriberId, data)`.
  - Implement `getMySubscriptions(subscriberId)`.
  - Implement `getProviderManifest(providerId)`.
  - Implement `setVacation(subscriberId, id, from, to)`.
  - Implement `resumeVacation(subscriberId, id)`.
  - Implement `reportMissedDelivery(subscriberId, id, deliveryId, reason)`.
  - Implement `cancelSubscription(subscriberId, id)`.
  - Implement `settleEndedCycles()`.

- [ ] **Step 4: Create `subscription.controller.ts` & `subscription.routes.ts`**
  - Wire HTTP handlers with `asyncHandler`, `req.validated`, and `successResponse`.

- [ ] **Step 5: Mount routes in `src/app.ts`**
  - Add `app.use('/api/subscriptions', subscriptionRoutes)`.

- [ ] **Step 6: Verify TypeScript compilation**
  Run: `npm run build`
  Expected: Exit code 0.

---

### Task 5: Comprehensive Verification & Regression Test Suite

**Files:**
- Create: `src/scripts/test-services-subscriptions.ts`

- [ ] **Step 1: Write end-to-end test script**
  - Test one-time service booking, provider completion, and student confirmation with escrow payout.
  - Test subscription creation with 30 generated delivery slots.
  - Test vacation pause mode with instant pro-rata wallet refund.
  - Test missed delivery reporting with pro-rata wallet refund.
  - Test cycle settlement to provider minus 2% platform fee.
  - Test double-entry ledger balance integrity.

- [ ] **Step 2: Execute new test suite**
  Run: `npx ts-node src/scripts/test-services-subscriptions.ts`
  Expected: All assertions pass with exit code 0.

- [ ] **Step 3: Execute regression test suites**
  Run: `npx ts-node src/scripts/test-marketplace-flow.ts`
  Run: `npx ts-node src/scripts/test-enhancements-suite.ts`
  Expected: All scenarios pass with 0 regressions.
