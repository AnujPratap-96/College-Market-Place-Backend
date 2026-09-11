import http from 'http';
import app from './app';
import { env } from './config/env';
import { connectDatabase } from './lib/prisma';
import { initSocket } from './lib/socket';
import { registerEmailNotificationListeners } from './events/email-notification.listener';

const PORT = env.PORT || 5000;
const server = http.createServer(app);

initSocket(server);
registerEmailNotificationListeners();

const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();

    server.listen(PORT, () => {
      console.log(`🚀 Server running in ${env.NODE_ENV} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
