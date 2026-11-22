import crypto from "crypto";
import bcrypt from "bcryptjs";
import type { OtpPurpose } from "@prisma/client";
import { prisma } from "./prisma";
import { HttpError } from "./http";
import { sendMail } from "./mailer";

const OTP_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SEC = 60;

const subjects: Record<OtpPurpose, string> = {
  VERIFY_EMAIL: "Verify your World Vista email",
  RESET_PASSWORD: "Reset your World Vista password",
  CHANGE_EMAIL: "Confirm your new World Vista email",
  ADMIN_LOGIN: "World Vista admin sign-in code",
};

export async function issueOtp(opts: { email: string; purpose: OtpPurpose; userId?: string; payload?: string }) {
  const recent = await prisma.otp.findFirst({
    where: { email: opts.email, purpose: opts.purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_SEC * 1000) {
    throw new HttpError(429, `Please wait ${RESEND_COOLDOWN_SEC} seconds before requesting another code`);
  }
  // Invalidate earlier codes for the same purpose
  await prisma.otp.updateMany({
    where: { email: opts.email, purpose: opts.purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  const code = crypto.randomInt(100000, 999999).toString();
  await prisma.otp.create({
    data: {
      email: opts.email,
      purpose: opts.purpose,
      userId: opts.userId,
      payload: opts.payload,
      codeHash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60 * 1000),
    },
  });
  await sendMail(
    opts.email,
    subjects[opts.purpose],
    `Your World Vista verification code is ${code}.\nIt expires in ${OTP_TTL_MIN} minutes. Never share this code with anyone, including World Vista staff.`,
  );
}

/** Verifies and consumes an OTP. Returns the OTP record (for payload). */
export async function verifyOtp(email: string, purpose: OtpPurpose, code: string) {
  const otp = await prisma.otp.findFirst({
    where: { email, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.expiresAt < new Date()) throw new HttpError(400, "Code expired or not found. Request a new one.");
  if (otp.attempts >= MAX_ATTEMPTS) throw new HttpError(429, "Too many attempts. Request a new code.");
  const ok = await bcrypt.compare(code, otp.codeHash);
  if (!ok) {
    await prisma.otp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(400, "Incorrect code");
  }
  await prisma.otp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  return otp;
}
