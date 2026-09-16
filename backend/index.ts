import "dotenv/config";

import compression from "compression";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import fs from "fs";
import helmet from "helmet";
import multer from "multer";
import path from "path";
import apiRoutes from "./src/routes/api.routes";
import { getPublicPath } from "./src/config/paths";
import { IS_PRODUCTION } from "./src/config/constants";

dotenv.config({ path: path.resolve(process.cwd(), ".env.admin"), override: false, quiet: true });

const requiredEnvironment = ["SUPABASE_URL", "JWT_SECRET_KEY", "ADMIN_EMAIL", "ADMIN_PASSWORD_HASH"];
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]?.trim());
if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() && !process.env.SUPABASE_KEY?.trim()) {
  missingEnvironment.push("SUPABASE_SERVICE_ROLE_KEY");
}
if (missingEnvironment.length) {
  throw new Error(`Variáveis de ambiente em falta: ${missingEnvironment.join(", ")}`);
}
if ((process.env.JWT_SECRET_KEY?.length ?? 0) < 32) {
  console.warn("Aviso de segurança: JWT_SECRET_KEY deve ter pelo menos 32 caracteres aleatórios.");
}

const app = express();
const servePages = process.env.SERVE_PAGES !== "false";
let errorPagePath: string | undefined;

app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "true") app.set("trust proxy", 1);

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", "data:", "https:"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      upgradeInsecureRequests: IS_PRODUCTION ? [] : null,
    },
  },
}));
app.use(compression());
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb", parameterLimit: 20 }));

app.use("/api", apiRoutes);

if (servePages) {
  const publicPath = getPublicPath();
  errorPagePath = path.join(publicPath, "error.html");

  const pageRoutes = require("./src/routes/page.routes").default;
  app.use(pageRoutes);

  app.use(express.static(publicPath, {
    etag: true,
    maxAge: IS_PRODUCTION ? "1h" : 0,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
    },
  }));

} else {
  app.get("/", (_req: Request, res: Response) => {
    res.json({ message: "ElDorado Barbershop backend API is running." });
  });
}

app.use((req: Request, res: Response, next: NextFunction) => {
  if (
    servePages &&
    !req.path.startsWith("/api") &&
    errorPagePath &&
    fs.existsSync(errorPagePath)
  ) {
    return res.status(404).sendFile(errorPagePath);
  }

  const error = new Error("Not found.") as Error & { status?: number };
  error.status = 404;
  next(error);
});

app.use((error: Error & { status?: number; type?: string }, req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "A imagem excede o limite de 5 MB."
      : "O envio da imagem é inválido.";
    return res.status(400).json({ message });
  }

  if (error instanceof SyntaxError && error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "O conteúdo do pedido não é JSON válido." });
  }

  const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
  if (status >= 500) console.error("Erro não tratado:", error);

  if (
    servePages &&
    !req.path.startsWith("/api") &&
    errorPagePath &&
    fs.existsSync(errorPagePath)
  ) {
    return res.status(status).sendFile(errorPagePath);
  }

  return res.status(status).json({
    message: status === 404 ? "Recurso não encontrado." : "Ocorreu um erro interno. Tenta novamente.",
  });
});

export default app;
