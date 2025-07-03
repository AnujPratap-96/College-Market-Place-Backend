// src/utils/sendOtpEmail.ts
// Use CommonJS-style require with type annotation

const SibApiV3Sdk = require('sib-api-v3-sdk') as typeof import('sib-api-v3-sdk');

export const sendOtpEmail = async (toEmail: string, otp: string) => {
  try {
    const client = SibApiV3Sdk.ApiClient.instance;
    client.authentications['api-key'].apiKey = process.env.BREVO_API_KEY!;

    const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

    const emailPayload = {
      to: [{ email: toEmail }],
      sender: {
        name: 'College Market-Place',
        email: 'officialthakur94@gmail.com',
      },
      subject: 'Your OTP Code',
      htmlContent: `<p>Your OTP is <strong>${otp}</strong></p>`,
    };

    await emailApi.sendTransacEmail(emailPayload);
    console.log("✅ OTP email sent!");
  } catch (error) {
    console.error("❌ Failed to send email:", error);
    throw new Error("Email send failed.");
  }
};
