export type OtpEmailPurpose = 'SIGNUP' | 'RESET' | 'LOGIN' | 'ORDER_PICKUP';

interface OtpTemplateOptions {
  otp: string;
  purpose?: OtpEmailPurpose;
  userName?: string;
}

export const renderOtpEmailHtml = ({ otp, purpose = 'SIGNUP', userName }: OtpTemplateOptions): { subject: string; html: string } => {
  let title = 'Verify Your Email';
  let subtitle = 'Welcome to College Marketplace! Complete your registration using the one-time verification code below.';
  let subject = `[${otp}] Your College Marketplace Verification Code`;

  if (purpose === 'RESET') {
    title = 'Reset Your Password';
    subtitle = 'We received a request to reset your password. Use the verification code below to proceed with setting a new password.';
    subject = `[${otp}] Password Reset Code for College Marketplace`;
  } else if (purpose === 'LOGIN') {
    title = 'One-Time Login Code';
    subtitle = 'Use this code to securely log in to your College Marketplace account without entering a password.';
    subject = `[${otp}] Your One-Time Login Code — College Marketplace`;
  } else if (purpose === 'ORDER_PICKUP') {
    title = 'Handover Verification OTP';
    subtitle = 'Share this 6-digit code with the seller or provider only when you have physically received your item or service.';
    subject = `[${otp}] Your Pickup Handover Code — College Marketplace`;
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .email-container { max-width: 580px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e4e4e7; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #ea580c 0%, #f97316 50%, #fb923c 100%); padding: 36px 30px; text-align: center; }
    .logo-badge { display: inline-flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.2); border-radius: 9999px; padding: 8px 18px; margin-bottom: 12px; }
    .logo-text { color: #ffffff; font-weight: 700; font-size: 16px; letter-spacing: 0.5px; text-transform: uppercase; }
    .header-title { color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; line-height: 1.3; }
    .content { padding: 36px 32px; color: #27272a; line-height: 1.6; }
    .greeting { font-size: 16px; font-weight: 600; color: #18181b; margin-bottom: 12px; }
    .description { font-size: 15px; color: #52525b; margin: 0 0 28px 0; }
    .otp-box { background: #fff7ed; border: 2px dashed #f97316; border-radius: 12px; padding: 24px 16px; text-align: center; margin: 28px 0; }
    .otp-label { font-size: 12px; font-weight: 700; color: #c2410c; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .otp-digits { font-size: 38px; font-weight: 900; color: #ea580c; letter-spacing: 10px; font-family: 'Courier New', Courier, monospace; line-height: 1; user-select: all; }
    .timer-badge { display: inline-block; background: #fee2e2; color: #991b1b; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 9999px; margin-top: 12px; }
    .security-notice { background: #f4f4f5; border-radius: 10px; padding: 16px; margin: 24px 0 0 0; border-left: 4px solid #f97316; }
    .security-text { font-size: 13px; color: #71717a; margin: 0; line-height: 1.5; }
    .security-bold { font-weight: 600; color: #3f3f46; }
    .footer { background: #fafafa; border-top: 1px solid #f4f4f5; padding: 24px 32px; text-align: center; color: #a1a1aa; font-size: 12px; line-height: 1.6; }
    .footer a { color: #ea580c; text-decoration: none; }
  </style>
</head>
<body>
  <div style="padding: 20px 10px;">
    <div class="email-container">
      <div class="header">
        <div class="logo-badge">
          <span class="logo-text">🎓 College Marketplace</span>
        </div>
        <h1 class="header-title">${title}</h1>
      </div>

      <div class="content">
        ${userName ? `<div class="greeting">Hi ${userName},</div>` : `<div class="greeting">Hello!</div>`}
        <p class="description">${subtitle}</p>

        <div class="otp-box">
          <div class="otp-label">Your One-Time Code</div>
          <div class="otp-digits">${otp}</div>
          <div>
            <span class="timer-badge">⏱ Expires in 5 minutes</span>
          </div>
        </div>

        <div class="security-notice">
          <p class="security-text">
            <span class="security-bold">Security Tip:</span> CampusCart staff will never ask for your verification code or password. If you did not initiate this request, please disregard this email or review your account settings.
          </p>
        </div>
      </div>

      <div class="footer">
        <p style="margin: 0 0 6px 0;"><strong>College Marketplace</strong> — Peer-to-Peer Student Trading & Services</p>
        <p style="margin: 0 0 6px 0;">Built by students, for students. Safe, verified, and campus-exclusive.</p>
        <p style="margin: 0;">This is an automated message. Please do not reply directly to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
};
