import { logger } from '../utils/logger';
import { env } from '../config/env';
import dotenv from 'dotenv';
dotenv.config();

import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import SibApiV3Sdk from 'sib-api-v3-sdk';

export interface EmailJob {
  to: string;
  subject: string;
  html: string;
  senderName?: string;
  senderEmail?: string;
  retries?: number;
}

const redisUrl = env.REDIS_DB_URL;
if (!redisUrl) {
  logger.warn('[EmailQueue] WARNING: REDIS_DB_URL is not set. BullMQ will fail to connect if Redis is not available locally.');
}

const redisConnection = new Redis(redisUrl || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

const queueName = 'email-queue';

export const emailBullQueue = new Queue<EmailJob>(queueName, {
  connection: redisConnection,
  skipVersionCheck: true,
});

class EmailQueue {
  constructor() {
    this.initBrevoClient();
  }

  private initBrevoClient() {
    const apiKey = env.BREVO_API_KEY;
    if (apiKey) {
      const client = SibApiV3Sdk.ApiClient.instance;
      client.authentications['api-key'].apiKey = apiKey;
    }
  }

  enqueue(job: EmailJob): void {
    emailBullQueue.add('send-email', job, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    }).catch(err => {
      logger.error('[EmailQueue] Failed to enqueue job:', err);
    });
  }

  async sendNow(job: EmailJob): Promise<boolean> {
    return this.deliverEmail(job);
  }

  async deliverEmail(job: EmailJob): Promise<boolean> {
    try {
      const start = Date.now();
      const apiKey = env.BREVO_API_KEY;
      if (!apiKey || apiKey.trim() === '') {
        logger.warn(`[EmailQueue] BREVO_API_KEY not configured. Simulated dispatch to: ${job.to}`);
        return true;
      }

      this.initBrevoClient();
      const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

      const senderEmail = job.senderEmail || 'officialthakur94@gmail.com';
      const senderName = job.senderName || 'College Marketplace';

      const emailPayload = {
        to: [{ email: job.to }],
        sender: {
          name: senderName,
          email: senderEmail,
        },
        subject: job.subject,
        htmlContent: job.html,
      };

      await emailApi.sendTransacEmail(emailPayload);
      const elapsed = Date.now() - start;
      logger.info(`[EmailQueue] Dispatched "${job.subject}" to ${job.to} in ${elapsed}ms`);
      return true;
    } catch (err: any) {
      logger.error(`[EmailQueue] Failed sending to ${job.to}:`, err?.response?.body || err.message);
      throw err;
    }
  }
}

export const emailQueue = new EmailQueue();

const emailWorker = new Worker<EmailJob>(
  queueName,
  async (job: Job<EmailJob>) => {
    await emailQueue.deliverEmail(job.data);
  },
  { 
    connection: redisConnection,
    skipVersionCheck: true 
  }
);

emailWorker.on('completed', (job) => {
  logger.info(`[EmailWorker] Job ${job.id} completed successfully`);
});

emailWorker.on('failed', (job, err) => {
  logger.error(`[EmailWorker] Job ${job?.id} failed with error: ${err.message}`);
});
