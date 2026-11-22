import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { env } from "../lib/env";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http";

export const COOKIE = "wv_session";
const MAX_AGE_SEC = 12 * 60 * 60;

export type AuthUser = { id: string; role: Role; memberId: string; email: string; fullName: string };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function setSession(res: Response, user: { id: string; tokenVersion: number }) {
  const token = jwt.sign({ sub: user.id, v: user.tokenVersion }, env.jwtSecret, { expiresIn: MAX_AGE_SEC });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    maxAge: MAX_AGE_SEC * 1000,
    path: "/",
  });
}

export function clearSession(res: Response) {
  res.clearCookie(COOKIE, { path: "/" });
}

async function loadUser(req: Request): Promise<AuthUser | null> {
  const token = req.cookies?.[COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string; v: number };
    const u = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!u || u.tokenVersion !== payload.v || u.status === "SUSPENDED") return null;
    return { id: u.id, role: u.role, memberId: u.memberId, email: u.email, fullName: u.fullName };
  } catch {
    return null;
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = (await loadUser(req)) ?? undefined;
  next();
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const u = await loadUser(req);
  if (!u) return next(new HttpError(401, "Not signed in"));
  req.user = u;
  next();
}

export const ADMIN_ROLES: Role[] = ["SUPER_ADMIN", "FINANCE_ADMIN", "SUPPORT_ADMIN", "CONTENT_ADMIN"];

/** Allows SUPER_ADMIN always, plus any listed roles. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, "Not signed in"));
    if (req.user.role === "SUPER_ADMIN" || roles.includes(req.user.role)) return next();
    next(new HttpError(403, "You do not have permission for this action"));
  };
}
