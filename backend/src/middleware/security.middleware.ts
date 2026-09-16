import { NextFunction, Request, Response } from "express";

export function requireSameOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.get("origin");
  if (!origin) return next();

  try {
    if (new URL(origin).host !== req.get("host")) {
      return res.status(403).json({ message: "Origem do pedido não autorizada." });
    }
  } catch {
    return res.status(403).json({ message: "Origem do pedido inválida." });
  }

  next();
}
