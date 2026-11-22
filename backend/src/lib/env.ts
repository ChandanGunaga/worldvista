import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",
  jwtSecret: required("JWT_SECRET"),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
  },
  mailFrom: process.env.MAIL_FROM ?? "World Vista <no-reply@worldvista.example>",
  /** Number of reverse proxies in front of the API (Railway + Vercel = 2). */
  trustProxy: Number(process.env.TRUST_PROXY ?? 1),
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? "",
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: process.env.CLOUDINARY_API_KEY ?? "",
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
    authToken: process.env.TWILIO_AUTH_TOKEN ?? "",
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM ?? "",
  },
  sentryDsn: process.env.SENTRY_DSN ?? "",
  uploadDir: process.env.UPLOAD_DIR ?? "uploads",
};

if (env.isProd) {
  if (env.jwtSecret.length < 32) throw new Error("JWT_SECRET must be at least 32 characters in production");
  if (!env.smtp.host) throw new Error("SMTP_HOST is required in production");
  if (!env.frontendUrl.startsWith("https://")) console.warn("WARNING: FRONTEND_URL should be https:// in production");
}

export const features = {
  payments: Boolean(env.razorpay.keyId && env.razorpay.keySecret),
  cloudinary: Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret),
  whatsapp: Boolean(env.twilio.accountSid && env.twilio.authToken && env.twilio.whatsappFrom),
  email: Boolean(env.smtp.host),
  sentry: Boolean(env.sentryDsn),
};
