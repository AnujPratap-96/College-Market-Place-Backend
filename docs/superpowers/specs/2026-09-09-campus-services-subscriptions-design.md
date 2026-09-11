# Design Document: Campus Services & Recurring Subscription Delivery System

**Date:** 2026-09-09  
**Status:** Approved by User  
**Target:** College Marketplace Backend (`/home/users/anuj.pratap/Documents/Python-Learning/College Marketplace/Backend`)

---

## 1. Overview & Objectives

In addition to one-time physical goods (`SELL`) and temporary rentals (`RENT`), campus commerce relies heavily on two other business models:
1. **One-Time Services (`SERVICE`)**: Gigs and tasks like PC/laptop formatting, cycle puncture repair, thesis/project binding, room shifting, or senior resume reviews.
2. **Recurring Subscriptions (`SUBSCRIPTION`)**: Periodic deliveries and services like hostel lunch/dinner tiffin, weekly laundry plans, water can refills, or weekly coding tutoring.

This document specifies the end-to-end backend architecture for supporting both `SERVICE` and `SUBSCRIPTION` listings with wallet escrow protection, vacation pause modes, pro-rata refund calculations, and cycle milestone payouts without incurring per-delivery email/SMS costs.

---

## 2. Database Schema Design (Prisma)

### 2.1 Enum Updates
```prisma
enum ProductType {
  SELL
  RENT
  SERVICE
  SUBSCRIPTION
}

enum OrderType {
  PURCHASE
  RENTAL
  SERVICE
}

enum SubscriptionStatus {
  ACTIVE
  PAUSED
  CANCELLED
  EXPIRED
  DISPUTED
}

enum SubscriptionFrequency {
  WEEKLY
  MONTHLY
}

enum DeliveryScheduleStatus {
  SCHEDULED
  COMPLETED
  SKIPPED
  MISSED
}
```

### 2.2 Model Extensions

#### A. `Product` Model
Extend with subscription-specific metadata:
- `frequency SubscriptionFrequency?`
- `deliverySlots String?` (e.g., `"12:30 PM - 1:30 PM"`)
- `serviceDuration String?` (e.g., `"1-2 hours"` for one-time services)

#### B. `Order` Model
Add support for `SERVICE`:
- When `orderType === OrderType.SERVICE`, status begins in `ESCROW_HELD`.
- Provider completes task -> triggers `DELIVERED`/`PENDING_CONFIRMATION`.
- Student confirms completion (or enters completion OTP) -> `COMPLETED`, releasing payout to provider minus 2% fee.

#### C. New `Subscription` Model
```prisma
model Subscription {
  id                 String                @id @default(cuid())
  subscriptionNumber String                @unique
  subscriberId       String
  subscriber         User                  @relation("UserSubscriptions", fields: [subscriberId], references: [id])
  providerId         String
  provider           User                  @relation("ProviderSubscriptions", fields: [providerId], references: [id])
  productId          String
  product            Product               @relation(fields: [productId], references: [id])
  frequency          SubscriptionFrequency @default(MONTHLY)
  cycleAmount        Float
  platformFee        Float                 @default(0.0)
  startDate          DateTime
  endDate            DateTime
  nextBillingDate    DateTime
  status             SubscriptionStatus    @default(ACTIVE)
  autoRenew          Boolean               @default(false)
  deliverySlots      String?
  vacationFrom       DateTime?
  vacationTo         DateTime?
  deliveries         SubscriptionDelivery[]
  createdAt          DateTime              @default(now())
  updatedAt          DateTime              @updatedAt
}
```

#### D. New `SubscriptionDelivery` Model
```prisma
model SubscriptionDelivery {
  id             String                 @id @default(cuid())
  subscriptionId String
  subscription   Subscription           @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  scheduledDate  DateTime
  status         DeliveryScheduleStatus @default(SCHEDULED)
  note           String?
  createdAt      DateTime               @default(now())
}
```

---

## 3. Financial Lifecycle & Ledger Accounting

### 3.1 One-Time Services (`SERVICE`)
1. **Hold**: Student books service -> `walletService.holdEscrow(studentId, fee, orderId, tx)` (Ledger: `HOLD`).
2. **Complete**: Provider marks task done on provider dashboard.
3. **Release**: Student confirms satisfactory completion -> `walletService.releaseEscrow(studentId, providerId, fee, fee * 0.02, orderId, tx)` (Ledger: `RELEASE` for buyer, `CREDIT` for provider minus 2%).
4. **Dispute**: If provider fails to show up or damages item, student raises dispute via existing `POST /api/orders/:id/dispute`.

### 3.2 Recurring Subscriptions (`SUBSCRIPTION`)
1. **Initial Hold**: Student subscribes -> cycle fee (e.g. ₹1,800/month) held in buyer's wallet escrow (Ledger: `HOLD`).
2. **Delivery Manifest**: System generates calendar delivery schedule entries (`SubscriptionDelivery`).
3. **Vacation / Break Mode**:
   - Student sets `vacationFrom` and `vacationTo` in advance (e.g., 4 days home for festival).
   - System counts eligible scheduled deliveries within range.
   - Pro-rata amount = `(cycleAmount / totalDays) * vacationDays`.
   - Pro-rata amount is **instantly refunded back to student's available wallet balance** via `walletService.refundSubscriptionVacation(...)` (Ledger: `REFUND`).
   - Deliveries within the vacation window are marked `SKIPPED`.
4. **Missed Delivery Reporting**:
   - Student flags a missed delivery day (e.g. vendor didn't bring tiffin).
   - Delivery marked `MISSED` -> pro-rata daily cost refunded directly to student wallet.
5. **Cycle Settlement**:
   - At `endDate`, the remaining escrow balance minus 2% platform fee is disbursed to the provider's wallet balance (Ledger: `RELEASE` & `CREDIT`).
   - If `autoRenew: true`, system attempts to hold the next cycle fee from the student's available wallet balance. If insufficient, marks `status: EXPIRED` and alerts student via Socket.io.

---

## 4. API Endpoints Specification

All endpoints follow: `req -> route -> validate(requestSchema) -> controller -> service -> repository -> successResponse`.

### 4.1 Product Catalog
- `POST /api/products`: Supports `type: 'SERVICE'` or `'SUBSCRIPTION'` with frequency and delivery slots.

### 4.2 One-Time Services
- `POST /api/orders/service-book`: Book service listing & hold escrow.
  - Body: `{ productId: string, preferredTime?: string, notes?: string }`
- `POST /api/orders/:id/service-complete`: Provider marks service task done.
- `POST /api/orders/:id/service-confirm`: Buyer confirms completion and releases escrow to provider.

### 4.3 Subscriptions Module (`src/modules/subscriptions/`)
- `POST /api/subscriptions/subscribe`:
  - Body: `{ productId: string, frequency: 'WEEKLY' | 'MONTHLY', deliverySlots?: string, autoRenew?: boolean }`
- `GET /api/subscriptions/my-subscriptions`:
  - Returns student's active subscriptions with upcoming scheduled deliveries.
- `GET /api/subscriptions/provider/manifest`:
  - Returns provider's active subscriber roster, dietary/slot notes, and today's delivery checklist.
- `POST /api/subscriptions/:id/vacation`:
  - Body: `{ vacationFrom: string (ISO), vacationTo: string (ISO) }`
  - Calculates pro-rata refund, credits student wallet, marks scheduled dates as `SKIPPED`.
- `POST /api/subscriptions/:id/resume`:
  - Clears vacation window.
- `POST /api/subscriptions/:id/report-missed`:
  - Body: `{ deliveryId: string, reason: string }`
  - Validates delivery belongs to user, marks `MISSED`, refunds daily pro-rata amount to student wallet.
- `POST /api/subscriptions/:id/cancel`:
  - Disables `autoRenew` and cancels at cycle end.
- `POST /api/subscriptions/cron/settle`:
  - Idempotent worker settling ended cycles and processing auto-renewals.

---

## 5. Verification Plan

1. **Type Safety & Build**: Ensure `npm run build` compiles with 0 errors.
2. **Service Flow Tests**:
   - Create `SERVICE` product.
   - Buyer books service -> verify escrow hold.
   - Provider completes task -> buyer confirms -> verify provider payout (-2% fee) and ledger integrity.
3. **Subscription Lifecycle Tests**:
   - Create `SUBSCRIPTION` product (e.g. Monthly Mess Plan ₹3000 for 30 days).
   - Student subscribes -> verify ₹3000 held in escrow and 30 scheduled deliveries created.
   - Student sets 3-day vacation -> verify ₹300 (10%) refunded to student wallet, escrow reduced to ₹2700, and 3 deliveries set to `SKIPPED`.
   - Student reports 1 missed delivery -> verify ₹100 refunded to student wallet.
   - Run cycle settlement -> verify remaining ₹2600 disbursed to provider minus 2% fee, order completed.
4. **Zero Regressions**: Run existing `test-marketplace-flow.ts` and `test-enhancements-suite.ts` to ensure 100% backward compatibility.
