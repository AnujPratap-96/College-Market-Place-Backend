import { logger } from '../utils/logger';
import { Request, Response, NextFunction } from 'express';

export default function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  const originalSend = res.send;
  res.send = function (body?: any) {
    if (!res.headersSent) {
      const elapsedNs = process.hrtime.bigint() - start;
      const elapsedMs = (Number(elapsedNs) / 1e6).toFixed(2);
      res.setHeader('X-Response-Time', `${elapsedMs}ms`);
      res.setHeader('Server-Timing', `total;dur=${elapsedMs}`);
    }
    return originalSend.call(this, body);
  };

  res.on('finish', () => {
    const elapsedNs = process.hrtime.bigint() - start;
    const duration = Math.round(Number(elapsedNs) / 1e6);
    logger.info(`[${req.id || 'REQ'}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });

  next();
}
