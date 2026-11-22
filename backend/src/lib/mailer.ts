import nodemailer from "nodemailer";
import { env } from "./env";

const transport = env.smtp.host
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    })
  : null;

/**
 * Sends an email. Without SMTP configured (development only) the message is
 * printed to the console so OTP flows can be tested locally. In production an
 * SMTP server is mandatory and message bodies are never logged.
 */
export async function sendMail(to: string, subject: string, text: string) {
  if (transport) {
    await transport.sendMail({ from: env.mailFrom, to, subject, text });
    return;
  }
  if (env.isProd) throw new Error("SMTP is not configured");
  console.log(`\n[DEV MAIL] To: ${to}\nSubject: ${subject}\n${text}\n`);
}
