import "./instrument";
import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import * as Sentry from "@sentry/node";
import { env, features } from "./lib/env";
import { errorHandler } from "./lib/http";
import { prisma } from "./lib/prisma";
import { authRouter } from "./routes/auth";
import { publicRouter } from "./routes/public";
import { memberRouter } from "./routes/member";
import { adminRouter } from "./routes/admin";
import { paymentsRouter, webhookRouter } from "./routes/payments";

const app = express();
app.set("trust proxy", env.trustProxy);
app.use(helmet());
app.use(cors({ origin: env.frontendUrl, credentials: true }));

// Webhooks need the raw body for signature checks, so they go before express.json()
app.use("/api/webhooks", webhookRouter);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use("/uploads", express.static(path.resolve(env.uploadDir), { maxAge: "30d", index: false }));

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "up" });
  } catch {
    res.status(503).json({ ok: false, db: "down" });
  }
});
app.use("/api/auth", authRouter);
app.use("/api/public", publicRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/member", memberRouter);
app.use("/api/admin", adminRouter);
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

if (features.sentry) Sentry.setupExpressErrorHandler(app);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`World Vista API listening on http://localhost:${env.port}`);
  console.log("Integrations:", Object.entries(features).map(([k, v]) => `${k}=${v ? "on" : "off"}`).join(" "));
});
