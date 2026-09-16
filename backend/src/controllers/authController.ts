import bcrypt from "bcrypt";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_MAX_AGE_MS, IS_PRODUCTION } from "../config/constants";

const cookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: "strict" as const,
  path: "/",
  maxAge: ADMIN_SESSION_MAX_AGE_MS,
};

export async function loginAdmin(req: Request, res: Response) {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const secret = process.env.JWT_SECRET_KEY;

  if (!adminEmail || !passwordHash || !secret) {
    return res.status(503).json({ message: "O acesso administrativo ainda não está configurado." });
  }

  if (!email || email.length > 150 || !password || password.length > 200) {
    return res.status(400).json({ message: "Preenche o email e a palavra-passe corretamente." });
  }

  const validPassword = await bcrypt.compare(password, passwordHash);
  if (email !== adminEmail || !validPassword) {
    return res.status(401).json({ message: "Email ou palavra-passe incorretos." });
  }

  const token = jwt.sign({ email: adminEmail, role: "admin" }, secret, {
    subject: "admin",
    algorithm: "HS256",
    issuer: "eldorado-backend",
    audience: "eldorado-admin",
    expiresIn: "8h",
  });

  res.cookie(ADMIN_COOKIE_NAME, token, cookieOptions);
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ authenticated: true, admin: { email: adminEmail } });
}

export function getAdminSession(_req: Request, res: Response) {
  return res.status(200).json({ authenticated: true });
}

export function logoutAdmin(_req: Request, res: Response) {
  res.clearCookie(ADMIN_COOKIE_NAME, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "strict",
    path: "/",
  });
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ message: "Sessão terminada." });
}
