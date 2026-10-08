import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_MAX_AGE_MS, IS_PRODUCTION } from "../config/constants";
import { env } from "../config/env";

export type AdminRequest = Request & {
  admin?: { email: string; role: "admin" };
};

function readCookie(req: Request, name: string): string | null {
  const cookies = req.headers.cookie?.split(";") ?? [];
  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split("=");
    if (key === name) {
      try { return decodeURIComponent(value.join("=")); }
      catch { return null; }
    }
  }
  return null;
}

function verifyAdminToken(req: AdminRequest): { email: string; role: "admin" } | null {
  const token = readCookie(req, ADMIN_COOKIE_NAME);
  if (!token) return null;

  try {
    const payload = jwt.verify(token, env.jwtSecret, {
      algorithms: ["HS256"],
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
    }) as jwt.JwtPayload & { email?: string; role?: string };

    if (payload.role !== "admin" || payload.email !== env.adminEmail || payload.sub !== "admin") return null;
    return { email: payload.email, role: "admin" };
  } catch {
    return null;
  }
}

function renewAdminCookie(req: AdminRequest, res: Response) {
  const token = readCookie(req, ADMIN_COOKIE_NAME);
  if (token) res.cookie(ADMIN_COOKIE_NAME, token, {
    httpOnly: true, secure: IS_PRODUCTION, sameSite: "strict", path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_MS,
  });
}

export function protectAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  const admin = verifyAdminToken(req);
  if (!admin) return res.status(401).json({ message: "A sessão expirou. Inicia sessão novamente." });
  req.admin = admin;
  renewAdminCookie(req, res);
  res.setHeader("Cache-Control", "no-store");
  next();
}

export function protectAdminPage(req: AdminRequest, res: Response, next: NextFunction) {
  const admin = verifyAdminToken(req);
  if (!admin) return res.redirect(303, "/admin/login");
  req.admin = admin;
  renewAdminCookie(req, res);
  res.setHeader("Cache-Control", "no-store");
  next();
}
