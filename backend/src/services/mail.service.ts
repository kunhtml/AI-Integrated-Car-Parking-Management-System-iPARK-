export async function sendMail(_to: string, _subject: string, _body: string) {
  // stub: in real app use nodemailer
  console.log("sendMail stub:", _to, _subject);
}

export async function sendOtpEmail(to: string, otp: string) {
  await sendMail(to, "Mã OTP iPARK", `Mã OTP của bạn là ${otp}`);
}

export function smtpConfigured() {
  // stub: false by default
  return false;
}
