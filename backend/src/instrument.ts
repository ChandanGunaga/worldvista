import "dotenv/config";
import * as Sentry from "@sentry/node";

// Error monitoring: enabled only when SENTRY_DSN is set. Must load before other imports.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.1,
  });
}
