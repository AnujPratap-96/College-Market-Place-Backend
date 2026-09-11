interface SenderTransferOptions {
  senderName: string;
  recipientName: string;
  amount: number;
  transferId: string;
  note?: string;
  remainingBalance?: number;
}

interface RecipientTransferOptions {
  recipientName: string;
  senderName: string;
  amount: number;
  transferId: string;
  note?: string;
  newBalance?: number;
}

export const renderSenderTransferReceiptHtml = ({
  senderName,
  recipientName,
  amount,
  transferId,
  note,
  remainingBalance,
}: SenderTransferOptions): { subject: string; html: string } => {
  const subject = `Transfer Sent: ₹${amount.toFixed(2)} to ${recipientName}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .email-container { max-width: 580px; margin: 30px auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e4e4e7; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 50%, #38bdf8 100%); padding: 32px 24px; text-align: center; }
    .logo-badge { display: inline-flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.2); border-radius: 9999px; padding: 6px 16px; margin-bottom: 10px; }
    .logo-text { color: #ffffff; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
    .header-title { color: #ffffff; font-size: 22px; font-weight: 800; margin: 0; }
    .content { padding: 32px 28px; color: #27272a; line-height: 1.6; }
    .greeting { font-size: 16px; font-weight: 600; color: #18181b; margin-bottom: 12px; }
    .amount-box { background: #f0f9ff; border: 2px dashed #0284c7; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
    .amount-digits { font-size: 36px; font-weight: 900; color: #0284c7; }
    .details-card { background: #fafafa; border: 1px solid #e4e4e7; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .footer { background: #fafafa; border-top: 1px solid #f4f4f5; padding: 20px 28px; text-align: center; color: #a1a1aa; font-size: 12px; }
  </style>
</head>
<body>
  <div style="padding: 20px 10px;">
    <div class="email-container">
      <div class="header">
        <div class="logo-badge"><span class="logo-text">🎓 College Marketplace</span></div>
        <h1 class="header-title">Transfer Successful</h1>
      </div>
      <div class="content">
        <div class="greeting">Hi ${senderName},</div>
        <p style="margin: 0 0 16px 0; color: #52525b;">Your wallet transfer has been processed successfully.</p>

        <div class="amount-box">
          <div style="font-size: 12px; font-weight: 700; color: #0369a1; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Amount Sent</div>
          <div class="amount-digits">₹${amount.toFixed(2)}</div>
        </div>

        <div class="details-card">
          <div class="row">
            <span style="color: #71717a;">Recipient:</span>
            <strong style="color: #18181b;">${recipientName}</strong>
          </div>
          <div class="row">
            <span style="color: #71717a;">Reference ID:</span>
            <strong style="color: #18181b; font-family: monospace;">${transferId}</strong>
          </div>
          ${note ? `
          <div class="row">
            <span style="color: #71717a;">Note:</span>
            <span style="color: #18181b; font-style: italic;">"${note}"</span>
          </div>` : ''}
          ${remainingBalance !== undefined ? `
          <div class="row" style="border-top: 1px solid #e4e4e7; margin-top: 8px; padding-top: 8px;">
            <span style="color: #71717a;">Remaining Wallet Balance:</span>
            <strong style="color: #0284c7;">₹${remainingBalance.toFixed(2)}</strong>
          </div>` : ''}
        </div>
      </div>
      <div class="footer">
        <p style="margin: 0 0 4px 0;"><strong>College Marketplace</strong> — Safe Student Peer-to-Peer Trading</p>
        <p style="margin: 0;">Automated notification. If you did not authorize this transfer, contact campus support immediately.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
};

export const renderRecipientTransferCreditHtml = ({
  recipientName,
  senderName,
  amount,
  transferId,
  note,
  newBalance,
}: RecipientTransferOptions): { subject: string; html: string } => {
  const subject = `Money Received: ₹${amount.toFixed(2)} from ${senderName}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .email-container { max-width: 580px; margin: 30px auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e4e4e7; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%); padding: 32px 24px; text-align: center; }
    .logo-badge { display: inline-flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.2); border-radius: 9999px; padding: 6px 16px; margin-bottom: 10px; }
    .logo-text { color: #ffffff; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
    .header-title { color: #ffffff; font-size: 22px; font-weight: 800; margin: 0; }
    .content { padding: 32px 28px; color: #27272a; line-height: 1.6; }
    .greeting { font-size: 16px; font-weight: 600; color: #18181b; margin-bottom: 12px; }
    .amount-box { background: #ecfdf5; border: 2px dashed #059669; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
    .amount-digits { font-size: 36px; font-weight: 900; color: #059669; }
    .details-card { background: #fafafa; border: 1px solid #e4e4e7; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .footer { background: #fafafa; border-top: 1px solid #f4f4f5; padding: 20px 28px; text-align: center; color: #a1a1aa; font-size: 12px; }
  </style>
</head>
<body>
  <div style="padding: 20px 10px;">
    <div class="email-container">
      <div class="header">
        <div class="logo-badge"><span class="logo-text">🎓 College Marketplace</span></div>
        <h1 class="header-title">Funds Received!</h1>
      </div>
      <div class="content">
        <div class="greeting">Hi ${recipientName},</div>
        <p style="margin: 0 0 16px 0; color: #52525b;">You have received funds in your College Marketplace wallet.</p>

        <div class="amount-box">
          <div style="font-size: 12px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Amount Credited</div>
          <div class="amount-digits">+₹${amount.toFixed(2)}</div>
        </div>

        <div class="details-card">
          <div class="row">
            <span style="color: #71717a;">From:</span>
            <strong style="color: #18181b;">${senderName}</strong>
          </div>
          <div class="row">
            <span style="color: #71717a;">Reference ID:</span>
            <strong style="color: #18181b; font-family: monospace;">${transferId}</strong>
          </div>
          ${note ? `
          <div class="row">
            <span style="color: #71717a;">Note:</span>
            <span style="color: #18181b; font-style: italic;">"${note}"</span>
          </div>` : ''}
          ${newBalance !== undefined ? `
          <div class="row" style="border-top: 1px solid #e4e4e7; margin-top: 8px; padding-top: 8px;">
            <span style="color: #71717a;">Available Balance:</span>
            <strong style="color: #059669;">₹${newBalance.toFixed(2)}</strong>
          </div>` : ''}
        </div>
      </div>
      <div class="footer">
        <p style="margin: 0 0 4px 0;"><strong>College Marketplace</strong> — Safe Student Peer-to-Peer Trading</p>
        <p style="margin: 0;">Automated notification. Log into your dashboard to spend or withdraw.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
};
