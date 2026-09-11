import { renderOtpEmailHtml, OtpEmailPurpose } from '../templates/otp-email.template';
import { emailQueue } from '../lib/email-queue';

export const sendOtpEmail = async (
  toEmail: string,
  otp: string,
  purpose: OtpEmailPurpose = 'SIGNUP',
  userName?: string
): Promise<void> => {
  const { subject, html } = renderOtpEmailHtml({ otp, purpose, userName });

  emailQueue.enqueue({
    to: toEmail,
    subject,
    html,
  });
};

export const sendOtpEmailSync = async (
  toEmail: string,
  otp: string,
  purpose: OtpEmailPurpose = 'SIGNUP',
  userName?: string
): Promise<boolean> => {
  const { subject, html } = renderOtpEmailHtml({ otp, purpose, userName });

  return emailQueue.sendNow({
    to: toEmail,
    subject,
    html,
  });
};
