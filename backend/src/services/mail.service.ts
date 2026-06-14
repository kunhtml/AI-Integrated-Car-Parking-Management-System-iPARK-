import { env } from "../config/env.js";
import { mailTransporter } from "../config/mail.js";

export async function sendOtpEmail(email: string, otp: string) {
  const subject = "iPARK - Mã OTP đặt lại mật khẩu";
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2>iPARK - Xác thực quên mật khẩu</h2>
      <p>Mã OTP của bạn là:</p>
      <div style="font-size:28px;font-weight:700;letter-spacing:6px;color:#2563eb">${otp}</div>
      <p>Mã này sẽ hết hạn sau ${env.otpExpiresInMinutes} phút.</p>
      <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
    </div>
  `;

  if (!env.smtp.host || !env.smtp.user || !env.smtp.pass) {
    console.log(`[DEV MAIL] Send OTP to ${email}: ${otp}`);
    return;
  }

  await mailTransporter.sendMail({
    from: env.smtp.from,
    to: email,
    subject,
    html,
  });
}
