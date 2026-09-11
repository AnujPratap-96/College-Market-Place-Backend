import SibApiV3Sdk from 'sib-api-v3-sdk';

export interface EmailJob {
  to: string;
  subject: string;
  html: string;
  senderName?: string;
  senderEmail?: string;
  retries?: number;
}

class EmailQueue {
  private queue: EmailJob[] = [];
  private isProcessing = false;
  private maxRetries = 3;

  constructor() {
    this.initBrevoClient();
  }

  private initBrevoClient() {
    const apiKey = process.env.BREVO_API_KEY;
    if (apiKey) {
      const client = SibApiV3Sdk.ApiClient.instance;
      client.authentications['api-key'].apiKey = apiKey;
    }
  }

  enqueue(job: EmailJob): void {
    this.queue.push({
      ...job,
      retries: job.retries ?? 0,
    });

    setImmediate(() => {
      this.processQueue();
    });
  }

  async sendNow(job: EmailJob): Promise<boolean> {
    return this.deliverEmail(job);
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const currentJob = this.queue.shift();
      if (!currentJob) continue;

      const success = await this.deliverEmail(currentJob);
      if (!success) {
        const attempts = (currentJob.retries || 0) + 1;
        if (attempts < this.maxRetries) {
          const delay = attempts * 2000;
          setTimeout(() => {
            this.enqueue({
              ...currentJob,
              retries: attempts,
            });
          }, delay);
        } else {
          console.error(`[EmailQueue] Job permanently failed after ${attempts} attempts for: ${currentJob.to}`);
        }
      }
    }

    this.isProcessing = false;
  }

  private async deliverEmail(job: EmailJob): Promise<boolean> {
    try {
      const start = Date.now();
      const apiKey = process.env.BREVO_API_KEY;
      if (!apiKey || apiKey.trim() === '') {
        console.warn(`[EmailQueue] BREVO_API_KEY not configured. Simulated dispatch to: ${job.to}`);
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
      console.log(`[EmailQueue] Dispatched "${job.subject}" to ${job.to} in ${elapsed}ms`);
      return true;
    } catch (err: any) {
      console.error(`[EmailQueue] Failed sending to ${job.to}:`, err?.response?.body || err.message);
      return false;
    }
  }
}

export const emailQueue = new EmailQueue();
