import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ADMIN_COOKIE_NAME } from "../config/constants";
import { env } from "../config/env";

export type AdminRequest = Request & {
  admin?: { email: string; role: "admin" };
};

function readCookie(req: Request, name: string): string | null {
  const cookies = req.headers.cookie?.split(";") ?? [];
  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
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

    if (payload.role !== "admin" || !payload.email || payload.sub !== "admin") return null;
    return { email: payload.email, role: "admin" };
  } catch {
    return null;
  }
}

export function protectAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  const admin = verifyAdminToken(req);
  if (!admin) return res.status(401).json({ message: "A sessão expirou. Inicia sessão novamente." });
  req.admin = admin;
  res.setHeader("Cache-Control", "no-store");
  next();
}

export function protectAdminPage(req: AdminRequest, res: Response, next: NextFunction) {
  const admin = verifyAdminToken(req);
  if (!admin) return res.redirect(303, "/admin/login");
  req.admin = admin;
  res.setHeader("Cache-Control", "no-store");
  next();
}
