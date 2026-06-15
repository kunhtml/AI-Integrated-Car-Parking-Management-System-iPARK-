export async function sendMail(_to: string, _subject: string, _body: string) {
  // stub: in real app use nodemailer
  console.log("sendMail stub:", _to, _subject);
}

export function smtpConfigured() {
  // stub: false by default
  return false;
}
