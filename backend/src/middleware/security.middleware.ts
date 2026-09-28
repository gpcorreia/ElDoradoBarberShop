import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

const stateChangingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function requireSameOrigin(req: Request, res: Response, next: NextFunction) {
  if (!stateChangingMethods.has(req.method)) return next();

  const origin = req.get("origin");
  const referer = req.get("referer");

  if (origin) {
    return origin === env.appOrigin
      ? next()
      : res.status(403).json({ message: "Origem do pedido não autorizada." });
  }

  if (referer) {
    try {
      return new URL(referer).origin === env.appOrigin
        ? next()
        : res.status(403).json({ message: "Origem do pedido não autorizada." });
    } catch {
      return res.status(403).json({ message: "Origem do pedido inválida." });
    }
  }

  return res.status(403).json({ message: "Pedido sem origem válida." });
}
