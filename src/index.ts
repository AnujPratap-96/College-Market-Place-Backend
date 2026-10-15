import { logger } from './utils/logger';
import http from 'http';
import app from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './lib/prisma';
import { initSocket } from './lib/socket';
import { registerEmailNotificationListeners } from './events/email-notification.listener';
import { backgroundScheduler } from './lib/scheduler';

const PORT = env.PORT || 5000;
const server = http.createServer(app);

initSocket(server);
registerEmailNotificationListeners();

let isShuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.warn(`🛑 Received ${signal}. Starting graceful shutdown...`);

  // Force shutdown after 10s if in-flight requests hang
  const forceTimer = setTimeout(() => {
    logger.error('⚠️  Graceful shutdown timed out after 10s. Forcing exit.');
    process.exit(1);
  }, 10000);
  forceTimer.unref();

  try {
    // 1. Stop background schedulers
    backgroundScheduler.stop();
    logger.info('⏹️  Background scheduler stopped.');

    // 2. Stop accepting new HTTP / WebSocket connections
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    logger.info('🔌 HTTP and WebSocket servers closed.');

    // 3. Disconnect database pool
    await disconnectDatabase();
    logger.info('🗄️  Database pool disconnected.');

    logger.info('✅ Graceful shutdown completed cleanly.');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (error: Error) => {
  logger.error('💥 Uncaught Exception:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('💥 Unhandled Promise Rejection:', reason);
  shutdown('UNHANDLED_REJECTION');
});

const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();
    backgroundScheduler.start(60000); // Run periodic auto-settlement and monitoring every 60s

    server.listen(PORT, () => {
      logger.info(`🚀 Server running in ${env.NODE_ENV} mode on port ${PORT}`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
