interface DisputeResolvedOptions {
  recipientName: string;
  orderNumber: string;
  productTitle: string;
  decision: 'REFUND_BUYER' | 'RELEASE_SELLER';
  resolutionNote: string;
  amount: number;
}

export const renderDisputeResolvedHtml = ({
  recipientName,
  orderNumber,
  productTitle,
  decision,
  resolutionNote,
  amount,
}: DisputeResolvedOptions): { subject: string; html: string } => {
  const subject = `Dispute Resolved: Order #${orderNumber}`;

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
    .header { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #4338ca 100%); padding: 32px 24px; text-align: center; }
    .logo-badge { display: inline-flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.2); border-radius: 9999px; padding: 6px 16px; margin-bottom: 10px; }
    .logo-text { color: #ffffff; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
    .header-title { color: #ffffff; font-size: 22px; font-weight: 800; margin: 0; }
    .content { padding: 32px 28px; color: #27272a; line-height: 1.6; }
    .greeting { font-size: 16px; font-weight: 600; color: #18181b; margin-bottom: 12px; }
    .details-card { background: #fafafa; border: 1px solid #e4e4e7; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .decision-box { background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 10px; padding: 14px; margin: 16px 0; font-size: 14px; color: #3730a3; }
    .footer { background: #fafafa; border-top: 1px solid #f4f4f5; padding: 20px 28px; text-align: center; color: #a1a1aa; font-size: 12px; }
  </style>
</head>
<body>
  <div style="padding: 20px 10px;">
    <div class="email-container">
      <div class="header">
        <div class="logo-badge"><span class="logo-text">🎓 College Marketplace</span></div>
        <h1 class="header-title">Dispute Case Resolved</h1>
      </div>
      <div class="content">
        <div class="greeting">Hi ${recipientName},</div>
        <p style="margin: 0 0 16px 0; color: #52525b;">The dispute opened for Order <strong>#${orderNumber}</strong> (${productTitle}) has been reviewed and resolved by Campus Administration.</p>

        <div class="decision-box">
          <strong>Decision:</strong> ${decision === 'REFUND_BUYER' ? 'Escrow Refunded to Buyer' : 'Funds Released to Seller'}
          <br/>
          <strong>Resolution Note:</strong> ${resolutionNote}
        </div>

        <div class="details-card">
          <div class="row">
            <span style="color: #71717a;">Order Number:</span>
            <strong style="color: #18181b;">${orderNumber}</strong>
          </div>
          <div class="row">
            <span style="color: #71717a;">Item:</span>
            <strong style="color: #18181b;">${productTitle}</strong>
          </div>
          <div class="row">
            <span style="color: #71717a;">Arbitrated Amount:</span>
            <strong style="color: #4f46e5;">₹${amount.toFixed(2)}</strong>
          </div>
        </div>
      </div>
      <div class="footer">
        <p style="margin: 0 0 4px 0;"><strong>College Marketplace</strong> — Safe Student Peer-to-Peer Trading</p>
        <p style="margin: 0;">Automated notification. If you have additional questions, contact student support.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
};
