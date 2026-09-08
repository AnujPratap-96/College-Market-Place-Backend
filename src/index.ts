import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/user.routes';
import productRoutes from './routes/product.routes';
import requestRoutes from './routes/request.routes';
import messageRoutes from './routes/message.routes';
import adminRoutes from './routes/admin.routes';
import cookieParser from 'cookie-parser';
import { connectDatabase } from './prisma';
import errorMiddleware from './middlewares/error.middleware';
import { notFoundHandler } from './middlewares/notFound.middleware';

dotenv.config();

const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173").split(",");

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'College Marketplace API is running' });
});

app.use('/api/user', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFoundHandler);
app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;

const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();