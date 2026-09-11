interface OrderReceiptBuyerOptions {
  buyerName: string;
  sellerName: string;
  productTitle: string;
  orderNumber: string;
  orderType: string;
  totalAmount: number;
  pickupOtp: string;
}

interface OrderReceiptSellerOptions {
  sellerName: string;
  buyerName: string;
  productTitle: string;
  orderNumber: string;
  orderType: string;
  payoutAmount: number;
}

export const renderBuyerOrderReceiptHtml = ({
  buyerName,
  sellerName,
  productTitle,
  orderNumber,
  orderType,
  totalAmount,
  pickupOtp,
}: OrderReceiptBuyerOptions): { subject: string; html: string } => {
  const subject = `Order Confirmed: ${productTitle} [${orderNumber}]`;

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
    .header { background: linear-gradient(135deg, #ea580c 0%, #f97316 50%, #fb923c 100%); padding: 32px 24px; text-align: center; }
    .logo-badge { display: inline-flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.2); border-radius: 9999px; padding: 6px 16px; margin-bottom: 10px; }
    .logo-text { color: #ffffff; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
    .header-title { color: #ffffff; font-size: 22px; font-weight: 800; margin: 0; }
    .content { padding: 32px 28px; color: #27272a; line-height: 1.6; }
    .greeting { font-size: 16px; font-weight: 600; color: #18181b; margin-bottom: 12px; }
    .order-card { background: #fafafa; border: 1px solid #e4e4e7; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .row-border { border-top: 1px solid #e4e4e7; margin-top: 10px; padding-top: 10px; font-weight: 700; font-size: 16px; color: #ea580c; }
    .otp-box { background: #fff7ed; border: 2px dashed #f97316; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
    .otp-digits { font-size: 34px; font-weight: 900; color: #ea580c; letter-spacing: 8px; font-family: monospace; }
    .safety-tip { background: #f4f4f5; border-radius: 10px; padding: 14px; border-left: 4px solid #f97316; font-size: 13px; color: #71717a; margin-top: 20px; }
    .footer { background: #fafafa; border-top: 1px solid #f4f4f5; padding: 20px 28px; text-align: center; color: #a1a1aa; font-size: 12px; }
  </style>
</head>
<body>
  <div style="padding: 20px 10px;">
    <div class="email-container">
      <div class="header">
        <div class="logo-badge"><span class="logo-text">🎓 College Marketplace</span></div>
        <h1 class="header-title">Order Confirmed!</h1>
      </div>
      <div class="content">
        <div class="greeting">Hi ${buyerName},</div>
        <p style="margin: 0 0 16px 0; color: #52525b;">Your order has been placed successfully. Funds are held securely in escrow until you verify item handover.</p>

        <div class="order-card">
          <div style="font-size: 12px; color: #a1a1aa; text-transform: uppercase; font-weight: 700; margin-bottom: 8px;">Order Details • ${orderType}</div>
          <div style="font-size: 16px; font-weight: 700; color: #18181b; margin-bottom: 12px;">${productTitle}</div>
          <div style="font-size: 13px; color: #71717a;">Order #: <strong>${orderNumber}</strong></div>
          <div style="font-size: 13px; color: #71717a;">Seller: <strong>${sellerName}</strong></div>
          <div class="row-border" style="display: flex; justify-content: space-between;">
            <span>Total Amount:</span>
            <span>₹${totalAmount.toFixed(2)}</span>
          </div>
        </div>

        <div class="otp-box">
          <div style="font-size: 12px; font-weight: 700; color: #c2410c; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Your Pickup Handover OTP</div>
          <div class="otp-digits">${pickupOtp}</div>
          <div style="font-size: 12px; color: #71717a; margin-top: 6px;">Share this 6-digit code with ${sellerName} only after inspecting the item.</div>
        </div>

        <div class="safety-tip">
          <strong>Campus Pickup Safety:</strong> Always meet fellow students in well-lit public campus locations (e.g. Student Activity Center, Campus Canteen, Library Lobby). Never share your OTP until the item is physically in your hands.
        </div>
      </div>
      <div class="footer">
        <p style="margin: 0 0 4px 0;"><strong>College Marketplace</strong> — Safe Student Peer-to-Peer Trading</p>
        <p style="margin: 0;">Automated notification. Need assistance? Message your seller in the app.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
};

export const renderSellerOrderNotificationHtml = ({
  sellerName,
  buyerName,
  productTitle,
  orderNumber,
  orderType,
  payoutAmount,
}: OrderReceiptSellerOptions): { subject: string; html: string } => {
  const subject = `New Order: ${productTitle} [${orderNumber}]`;

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
    .header { background: linear-gradient(135deg, #15803d 0%, #16a34a 50%, #22c55e 100%); padding: 32px 24px; text-align: center; }
    .logo-badge { display: inline-flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.2); border-radius: 9999px; padding: 6px 16px; margin-bottom: 10px; }
    .logo-text { color: #ffffff; font-weight: 700; font-size: 14px; text-transform: uppercase; }
    .header-title { color: #ffffff; font-size: 22px; font-weight: 800; margin: 0; }
    .content { padding: 32px 28px; color: #27272a; line-height: 1.6; }
    .order-card { background: #fafafa; border: 1px solid #e4e4e7; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .instructions { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px; margin: 20px 0; color: #166534; font-size: 14px; }
    .footer { background: #fafafa; border-top: 1px solid #f4f4f5; padding: 20px 28px; text-align: center; color: #a1a1aa; font-size: 12px; }
  </style>
</head>
<body>
  <div style="padding: 20px 10px;">
    <div class="email-container">
      <div class="header">
        <div class="logo-badge"><span class="logo-text">🎓 College Marketplace</span></div>
        <h1 class="header-title">Item Ordered!</h1>
      </div>
      <div class="content">
        <div style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Hi ${sellerName},</div>
        <p style="margin: 0 0 16px 0; color: #52525b;">Great news! <strong>${buyerName}</strong> has ordered your listing. The payment is held in escrow and will be released to your wallet upon OTP verification.</p>

        <div class="order-card">
          <div style="font-size: 12px; color: #a1a1aa; text-transform: uppercase; font-weight: 700; margin-bottom: 6px;">Listing • ${orderType}</div>
          <div style="font-size: 16px; font-weight: 700; color: #18181b; margin-bottom: 10px;">${productTitle}</div>
          <div style="font-size: 13px; color: #71717a;">Order #: <strong>${orderNumber}</strong></div>
          <div style="font-size: 13px; color: #71717a;">Buyer: <strong>${buyerName}</strong></div>
          <div style="border-top: 1px solid #e4e4e7; margin-top: 10px; padding-top: 10px; font-weight: 700; font-size: 16px; color: #16a34a; display: flex; justify-content: space-between;">
            <span>Escrow Payout:</span>
            <span>₹${payoutAmount.toFixed(2)}</span>
          </div>
        </div>

        <div class="instructions">
          <strong>Next Steps:</strong>
          <ol style="margin: 8px 0 0 0; padding-left: 20px; line-height: 1.6;">
            <li>Chat with ${buyerName} in the app to agree on a public campus meeting spot.</li>
            <li>Hand over the item in described condition.</li>
            <li>Ask ${buyerName} for their 6-digit Pickup OTP and verify it on your Orders dashboard to instantly release funds to your wallet.</li>
          </ol>
        </div>
      </div>
      <div class="footer">
        <p style="margin: 0 0 4px 0;"><strong>College Marketplace</strong> — Safe Student Peer-to-Peer Trading</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
};
