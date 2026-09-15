import { logger } from './utils/logger';
import http from 'http';
import app from './app';
import { env } from './config/env';
import { connectDatabase } from './lib/prisma';
import { initSocket } from './lib/socket';
import { registerEmailNotificationListeners } from './events/email-notification.listener';
import { backgroundScheduler } from './lib/scheduler';

const PORT = env.PORT || 5000;
const server = http.createServer(app);

initSocket(server);
registerEmailNotificationListeners();

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
