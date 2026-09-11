interface AuctionWinnerOptions {
  winnerName: string;
  sellerName: string;
  productTitle: string;
  winningBid: number;
  orderNumber: string;
  pickupOtp: string;
}

interface AuctionSellerOptions {
  sellerName: string;
  winnerName: string;
  productTitle: string;
  winningBid: number;
  orderNumber: string;
  payoutAmount: number;
}

export const renderAuctionWinnerHtml = ({
  winnerName,
  sellerName,
  productTitle,
  winningBid,
  orderNumber,
  pickupOtp,
}: AuctionWinnerOptions): { subject: string; html: string } => {
  const subject = `🏆 You Won the Auction! ${productTitle} [${orderNumber}]`;

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
    .header { background: linear-gradient(135deg, #b45309 0%, #f59e0b 50%, #fbbf24 100%); padding: 32px 24px; text-align: center; }
    .logo-badge { display: inline-flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.25); border-radius: 9999px; padding: 6px 16px; margin-bottom: 10px; }
    .logo-text { color: #ffffff; font-weight: 700; font-size: 14px; text-transform: uppercase; }
    .header-title { color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; }
    .content { padding: 32px 28px; color: #27272a; line-height: 1.6; }
    .card { background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .otp-box { background: #fff7ed; border: 2px dashed #ea580c; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
    .otp-digits { font-size: 34px; font-weight: 900; color: #c2410c; letter-spacing: 8px; font-family: monospace; }
    .footer { background: #fafafa; border-top: 1px solid #f4f4f5; padding: 20px 28px; text-align: center; color: #a1a1aa; font-size: 12px; }
  </style>
</head>
<body>
  <div style="padding: 20px 10px;">
    <div class="email-container">
      <div class="header">
        <div class="logo-badge"><span class="logo-text">🔨 Live Auction Arena</span></div>
        <h1 class="header-title">Congratulations! You Won!</h1>
      </div>
      <div class="content">
        <div style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Hi ${winnerName},</div>
        <p style="margin: 0 0 16px 0; color: #52525b;">Your bid was the highest when the auction ended! Your winning bid has been transferred to escrow protection.</p>

        <div class="card">
          <div style="font-size: 12px; color: #b45309; text-transform: uppercase; font-weight: 700; margin-bottom: 6px;">Auction Item</div>
          <div style="font-size: 18px; font-weight: 800; color: #18181b; margin-bottom: 8px;">${productTitle}</div>
          <div style="font-size: 13px; color: #71717a;">Seller: <strong>${sellerName}</strong></div>
          <div style="font-size: 13px; color: #71717a;">Order Ref: <strong>${orderNumber}</strong></div>
          <div style="border-top: 1px solid #fde68a; margin-top: 10px; padding-top: 10px; font-weight: 700; font-size: 18px; color: #b45309; display: flex; justify-content: space-between;">
            <span>Winning Bid:</span>
            <span>₹${winningBid.toFixed(2)}</span>
          </div>
        </div>

        <div class="otp-box">
          <div style="font-size: 12px; font-weight: 700; color: #c2410c; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Your Handover Pickup OTP</div>
          <div class="otp-digits">${pickupOtp}</div>
          <div style="font-size: 12px; color: #71717a; margin-top: 6px;">Provide this 6-digit code to ${sellerName} when receiving the item on campus.</div>
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

export const renderAuctionSellerSoldHtml = ({
  sellerName,
  winnerName,
  productTitle,
  winningBid,
  orderNumber,
  payoutAmount,
}: AuctionSellerOptions): { subject: string; html: string } => {
  const subject = `🎉 Auction Sold: ${productTitle} [₹${winningBid}]`;

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
    .footer { background: #fafafa; border-top: 1px solid #f4f4f5; padding: 20px 28px; text-align: center; color: #a1a1aa; font-size: 12px; }
  </style>
</head>
<body>
  <div style="padding: 20px 10px;">
    <div class="email-container">
      <div class="header">
        <div class="logo-badge"><span class="logo-text">🔨 Auction Complete</span></div>
        <h1 class="header-title">Your Item Has Sold!</h1>
      </div>
      <div class="content">
        <div style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Hi ${sellerName},</div>
        <p style="margin: 0 0 16px 0; color: #52525b;">Your live auction for <strong>${productTitle}</strong> has concluded. The winning bid was placed by <strong>${winnerName}</strong>.</p>

        <div style="background: #fafafa; border: 1px solid #e4e4e7; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <div style="font-size: 13px; color: #71717a;">Winning Bid: <strong>₹${winningBid.toFixed(2)}</strong></div>
          <div style="font-size: 13px; color: #71717a;">Order Ref: <strong>${orderNumber}</strong></div>
          <div style="border-top: 1px solid #e4e4e7; margin-top: 10px; padding-top: 10px; font-weight: 700; font-size: 16px; color: #16a34a; display: flex; justify-content: space-between;">
            <span>Net Escrow Payout:</span>
            <span>₹${payoutAmount.toFixed(2)}</span>
          </div>
        </div>

        <p style="font-size: 14px; color: #52525b;">Message ${winnerName} on campus to arrange the handover. Collect their 6-digit OTP to release your earnings to your wallet immediately.</p>
      </div>
      <div class="footer">
        <p style="margin: 0;"><strong>College Marketplace</strong> — Safe Student Peer-to-Peer Trading</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
};
