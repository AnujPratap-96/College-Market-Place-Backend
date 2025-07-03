export function generateOtp(length: number = 6) {
  const otp = Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

  return { otp, expiresAt };
}
