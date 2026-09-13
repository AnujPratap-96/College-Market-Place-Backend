import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { v4 as uuid } from 'uuid';
import { env } from './config/env';

import authRoutes from './modules/auth/auth.routes';
import productRoutes from './modules/products/product.routes';
import requestRoutes from './modules/requests/request.routes';
import messageRoutes from './modules/messages/message.routes';
import adminRoutes from './modules/admin/admin.routes';
import walletRoutes from './modules/wallet/wallet.routes';
import orderRoutes from './modules/orders/order.routes';
import subscriptionRoutes from './modules/subscriptions/subscription.routes';
import uploadRoutes from './modules/upload/upload.routes';
import auctionRoutes from './modules/auctions/auction.routes';
import assistantRoutes from './modules/assistant/assistant.routes';
import reviewRoutes from './modules/reviews/review.routes';
import wantedRoutes from './modules/wanted/wanted.routes';
import path from 'path';

import requestLogger from './middlewares/requestLogger.middleware';
import errorMiddleware from './middlewares/error.middleware';
import { notFoundHandler } from './middlewares/notFound.middleware';
import { successResponse } from './utils/response';

const app: Application = express();

// 1. Request ID Tracing
app.use((req: Request, res: Response, next: NextFunction) => {
  req.id = uuid();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// 2. Security Headers
app.use(helmet());

// 3. CORS Configuration
const allowedOrigins = (env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
    exposedHeaders: ['X-Response-Time', 'Server-Timing', 'X-Request-Id'],
  })
);

// 4. Rate Limiting (Global & Auth)
const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalRateLimiter);

// 5. Body Parsers & Cookies
app.use(express.json({
  verify: (req, _res, buffer) => {
    (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
  },
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 6. Request Logging
app.use(requestLogger);

// 7. Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  return successResponse(res, {
    statusCode: 200,
    message: 'College Marketplace API is healthy',
    data: { timestamp: new Date().toISOString() },
  });
});

// 8. Domain Routes
app.use('/api/user', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/wanted', wantedRoutes);
app.use('/uploads', express.static(path.resolve(process.cwd(), 'public', 'uploads')));

// 9. Error Handling
app.use(notFoundHandler);
app.use(errorMiddleware);

export default app;
