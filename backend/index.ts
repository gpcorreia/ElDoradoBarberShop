import "dotenv/config";

import compression from "compression";
import express, { NextFunction, Request, Response } from "express";
import fs from "fs";
import helmet from "helmet";
import multer from "multer";
import path from "path";
import apiRoutes from "./src/routes/api.routes";
import { env } from "./src/config/env";
import { getPublicPath } from "./src/config/paths";

const app = express();
const servePages = env.servePages;
let errorPagePath: string | undefined;

app.disable("x-powered-by");
app.set("trust proxy", env.trustProxy ? 1 : false);

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
      mediaSrc: ["'self'", "https://gyedyeygudoyvglpipua.supabase.co"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      upgradeInsecureRequests: env.isProduction ? [] : null,
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
    maxAge: env.isProduction ? "1h" : 0,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html") || filePath.endsWith(".js") || filePath.endsWith(".css")) {
        res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      }
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
