# CampusCart - Student Marketplace Backend

The backend API and real-time service for CampusCart, a peer-to-peer college marketplace. It provides authentication, listings, rentals, services, subscriptions, auctions, wallet escrow, messaging, notifications, reviews, administration, and the CampusBuddy product assistant.

## Table of Contents

- [Feature Set](#feature-set)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database and Migrations](#database-and-migrations)
- [Wallet Payments](#wallet-payments)
- [Real-Time Features](#real-time-features)
- [Available Scripts](#available-scripts)
- [API Areas](#api-areas)
- [Security Notes](#security-notes)

## Feature Set

### Authentication and Users

- JWT-based login and signup sessions
- Email and phone verification flows
- Password reset with OTP
- Protected routes and role-based admin access
- Profile updates and account verification status

### Marketplace

- Product listings for sale, rent, services, subscriptions, and auctions
- Search, category filters, availability status, and moderation flags
- Product reports and admin review
- Supabase signed upload URLs for product and profile images

### Orders and Escrow

- Wallet-funded purchase, rental, service, and auction orders
- Buyer and seller order workflows
- Escrow holds, releases, refunds, and ledger entries
- Six-digit pickup and return OTP verification
- Disputes and administrative resolution

### Auctions

- Live bids through Socket.io
- Minimum bid increments
- Anti-sniping extensions
- Automatic outbid refunds
- Auction settlement into escrow orders

### Wallet and Payments

- Available and escrow balances
- Wallet transfers and ledger history
- Razorpay wallet recharge flow
- Wallet credit only after a verified `payment.captured` webhook
- UPI withdrawal workflow
- Optimistic Concurrency Control (OCC) using Postgres version locking for safe checkouts

### Messaging and Notifications

- User-to-user conversations with optional product context
- Real-time message delivery and typing indicators
- Read receipts and unread counts
- Socket-based marketplace notifications
- BullMQ + Redis background worker for reliable transactional email delivery

### CampusBuddy Assistant & Search

- Instant Algolia Full-Text search integration (synced via Prisma hooks)
- Product search using stored embeddings and pgvector when configured
- Wallet, order, and marketplace guidance
- Mistral Vision (`pixtral-12b`) AI-powered auto-moderation and safety checks for product listings
- Admin synchronization endpoint for product embeddings

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Language | TypeScript 5.8 |
| Framework | Express 5 |
| Database | PostgreSQL / Supabase (with OCC version locking) |
| ORM | Prisma 6 |
| Authentication | JWT, bcrypt, HTTP cookies |
| Real-Time | Socket.io 4 |
| Job Queues | BullMQ + Redis |
| Search Engine | Algolia Full-Text Search |
| Payments | Razorpay |
| Storage | Supabase Storage and signed URLs |
| Validation | Zod |
| Email | Brevo SDK and Nodemailer |
| Security | Helmet, CORS, rate limiting |

## Project Structure

```text
Backend/
├── prisma/
│   ├── schema.prisma                 # Database models and enums
│   └── migrations/                   # Prisma migration SQL
├── src/
│   ├── config/                       # Environment configuration
│   ├── events/                       # Domain and email event listeners
│   ├── lib/                          # Prisma, Socket.io, events, utilities
│   ├── middlewares/                  # Auth, validation, errors, logging
│   ├── modules/
│   │   ├── admin/                    # Admin controls and moderation
│   │   ├── assistant/                # CampusBuddy and product vectors
│   │   ├── auctions/                 # Auctions and bidding
│   │   ├── auth/                     # Login, signup, OTP, sessions
│   │   ├── messages/                 # Conversations and messaging
│   │   ├── orders/                   # Orders, escrow, OTP handover
│   │   ├── products/                 # Marketplace listings
│   │   ├── reviews/                  # Reviews and trust metrics
│   │   ├── subscriptions/            # Recurring campus services
│   │   ├── upload/                   # Signed upload URLs
│   │   ├── users/                    # User profile operations
│   │   ├── wallet/                   # Wallet, ledger, payments
│   │   └── wanted/                   # Wanted listings and offers
│   ├── scripts/                      # Seed, admin, diagnostic, and test scripts
│   ├── app.ts                        # Express application and routes
│   └── index.ts                      # HTTP and Socket.io server startup
├── .env.example
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 20 or newer
- npm
- PostgreSQL or a Supabase PostgreSQL project
- Razorpay test keys for wallet payment testing

### Install Dependencies

```bash
cd Backend
npm install
```

### Configure Environment

```bash
copy .env.example .env
```

Fill in the database, JWT, Supabase, email, and Razorpay values before starting the server.

### Generate Prisma Client

The build script runs this automatically, but it can also be run manually:

```bash
npx prisma generate
```

### Start Development Server

```bash
npm run dev
```

The API runs on `http://localhost:5000` by default. The health endpoint is:

```text
GET http://localhost:5000/api/health
```

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | HTTP server port, normally `5000` |
| `NODE_ENV` | `development`, `test`, or `production` |
| `ALLOWED_ORIGINS` | Comma-separated frontend origins |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma |
| `DIRECT_URL` | Direct PostgreSQL URL for Prisma migrations when available |
| `JWT_LOGIN_SECRET` | Secret for login tokens |
| `JWT_SIGNUP_SECRET` | Secret for signup and verification tokens |
| `RAZORPAY_KEY_ID` | Razorpay test or live key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay test or live key secret |
| `RAZORPAY_WEBHOOK_SECRET` | Secret configured for Razorpay webhooks |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase service key |
| `SUPABASE_STORAGE_BUCKET` | Storage bucket for uploaded media |
| `BREVO_API_KEY` | Optional transactional email provider key |
| `ALGOLIA_APPLICATION_ID` | Algolia Application ID for search indexing |
| `ALGOLIA_ADMIN_API_KEY` | Algolia Admin API Key (Backend only, never expose) |

## Database and Migrations

The Prisma schema is located at `prisma/schema.prisma`.

For a fresh Prisma-managed database:

```bash
npx prisma migrate deploy
```

For the existing Supabase database used by this project, the original schema was created before Prisma migrations were baselined. Apply new additive migration SQL through the database SQL editor when `prisma migrate deploy` reports `P3005`.

The wallet webhook migration creates the `WalletTopupPayment` table:

```text
prisma/migrations/20260913120000_wallet_topup_webhook/migration.sql
```

Useful development commands:

```bash
npx prisma studio
npx prisma generate
```

## Wallet Payments

Wallet top-ups require a Razorpay payment in both test and live mode.

1. The authenticated client requests `POST /api/wallet/create-order`.
2. The server creates the Razorpay order and stores its user and amount.
3. The user completes payment in Razorpay Checkout.
4. Razorpay sends `payment.captured` to the webhook.
5. The server validates `x-razorpay-signature`, verifies the order amount, checks idempotency, and credits the wallet.

Webhook endpoint:

```text
POST /api/wallet/webhook/razorpay
```

Configure the full public HTTPS URL in the Razorpay dashboard. Do not expose `RAZORPAY_KEY_SECRET` or `RAZORPAY_WEBHOOK_SECRET` to the frontend.

## Real-Time Features

Socket.io is served from the same HTTP server. Clients authenticate with the login token and join a private user room.

Important events include:

- `send_message` / `receive_message`
- `typing` / `user_typing`
- `mark_read` / `messages_read`
- `join_auction` / `leave_auction`
- `new_bid`
- `auction_ended`

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the TypeScript server with Nodemon |
| `npm run build` | Generate Prisma Client and compile TypeScript |
| `npm start` | Start the compiled `dist` server |
| `npm run make-admin` | Create or promote an admin user |
| `npm run seed-catalog` | Seed the authentic development catalog |
| `npx prisma generate` | Generate the Prisma Client |
| `npx prisma studio` | Open the Prisma database browser |

## API Areas

All API routes are mounted under `/api`:

| Prefix | Responsibility |
|---|---|
| `/api/user` | Authentication and profiles |
| `/api/products` | Product listings |
| `/api/orders` | Orders, escrow, and handover |
| `/api/wallet` | Wallet, transfers, withdrawals, payments |
| `/api/messages` | Conversations and messages |
| `/api/auctions` | Auctions and bids |
| `/api/subscriptions` | Subscriptions and delivery actions |
| `/api/reviews` | Reviews and trust metrics |
| `/api/admin` | Admin dashboard operations |
| `/api/assistant` | CampusBuddy assistant |
| `/api/upload` | Signed media uploads |

## Security Notes

- All user-facing routes require authentication unless explicitly marked public.
- Admin routes require the `ADMIN` role.
- Wallet direct top-up is disabled; only the signed Razorpay webhook can credit funds.
- Webhook processing checks the raw-body HMAC signature, order amount, payment status event, and duplicate state.
- Never commit `.env` or payment credentials.
- Keep `ALLOWED_ORIGINS` restricted to trusted frontend domains in production.
- Run the production server with `NODE_ENV=production`.
