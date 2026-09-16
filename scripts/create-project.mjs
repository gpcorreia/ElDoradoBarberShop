#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

function printHelp() {
  console.log(`
Criador de projetos Node + Express + TypeScript

Utilização:
  node create-project.mjs <nome> [opções]

Opções:
  --destination <pasta>  Caminho completo do novo projeto
  --install              Instala as dependências do backend
  --git                  Inicializa um repositório Git
  --dry-run              Mostra o que seria criado sem escrever ficheiros
  --help                 Mostra esta ajuda

Exemplos:
  node create-project.mjs minha-app
  node create-project.mjs minha-app --destination C:\\Projetos\\minha-app
  node create-project.mjs minha-app --install --git
`);
}

function readArguments(argumentsList) {
  const options = {
    name: "",
    destination: "",
    install: false,
    git: false,
    dryRun: false,
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === "--help" || argument === "-h") {
      printHelp();
      process.exit(0);
    }

    if (argument === "--install") options.install = true;
    else if (argument === "--git") options.git = true;
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--destination") {
      options.destination = argumentsList[index + 1] ?? "";
      index += 1;
    } else if (argument.startsWith("--")) {
      throw new Error(`Opção desconhecida: ${argument}`);
    } else if (!options.name) {
      options.name = argument;
    } else {
      throw new Error(`Argumento inesperado: ${argument}`);
    }
  }

  if (!options.name) throw new Error("Indica o nome do projeto.");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(options.name)) {
    throw new Error("O nome só pode conter letras, números, pontos, hífenes e underscores.");
  }
  if (argumentsList.includes("--destination") && !options.destination) {
    throw new Error("A opção --destination precisa de um caminho.");
  }

  return options;
}

function packageNameFrom(projectName) {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "");
}

function titleFrom(projectName) {
  return projectName
    .replace(/[-_.]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function ensureSafeTarget(target) {
  if (!existsSync(target)) return;
  if (readdirSync(target).length > 0) {
    throw new Error(`A pasta de destino já existe e não está vazia: ${target}`);
  }
}

function run(command, args, cwd) {
  const executable = process.platform === "win32" && command === "npm" ? "npm.cmd" : command;
  const result = spawnSync(executable, args, { cwd, stdio: "inherit", shell: false });
  if (result.status !== 0) throw new Error(`O comando falhou: ${command} ${args.join(" ")}`);
}

const options = readArguments(process.argv.slice(2));
const projectName = packageNameFrom(options.name);
const projectTitle = titleFrom(options.name);
const target = resolve(options.destination || join(process.cwd(), options.name));

const files = {
  ".gitignore": `node_modules/
dist/
.env
.env.*
!.env.example
*.log
.DS_Store
Thumbs.db
`,
  "README.md": `# ${projectTitle}

Projeto com backend Node.js/Express/TypeScript e frontend HTML/CSS/JavaScript.

## Iniciar

\`\`\`bash
cd backend
copy .env.example .env
npm install
npm run dev
\`\`\`

Abre http://localhost:3000.

## Estrutura

- \`backend/src/controllers\`: recebe pedidos HTTP e produz respostas.
- \`backend/src/routes\`: define as rotas da API.
- \`backend/src/services\`: regras de negócio.
- \`backend/src/repositories\`: acesso à base de dados.
- \`backend/src/middleware\`: middleware do Express.
- \`backend/src/config\`: configuração da aplicação.
- \`frontend\`: páginas, estilos, JavaScript, componentes e imagens.
`,
  "backend/package.json": JSON.stringify({
    name: `${projectName}-backend`,
    version: "1.0.0",
    private: true,
    scripts: {
      dev: "nodemon --watch src --ext ts --exec ts-node src/server.ts",
      build: "tsc",
      start: "node dist/server.js",
      "type-check": "tsc --noEmit",
    },
    dependencies: {
      compression: "^1.8.1",
      cors: "^2.8.5",
      dotenv: "^17.2.3",
      express: "^5.2.1",
    },
    devDependencies: {
      "@types/compression": "^1.8.1",
      "@types/cors": "^2.8.19",
      "@types/express": "^5.0.6",
      "@types/node": "^25.0.3",
      nodemon: "^3.1.11",
      "ts-node": "^10.9.2",
      typescript: "^5.9.3",
    },
  }, null, 2) + "\n",
  "backend/tsconfig.json": `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "rootDir": "src",
    "outDir": "dist",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
`,
  "backend/.env.example": `PORT=3000
NODE_ENV=development
`,
  "backend/src/config/env.ts": `import "dotenv/config";

function readPort(value: string | undefined): number {
  const port = Number(value ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT tem de ser um número entre 1 e 65535.");
  }
  return port;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: readPort(process.env.PORT),
};
`,
  "backend/src/controllers/health.controller.ts": `import { Request, Response } from "express";

export function getHealth(_req: Request, res: Response) {
  return res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
}
`,
  "backend/src/routes/health.routes.ts": `import { Router } from "express";
import { getHealth } from "../controllers/health.controller";

const router = Router();
router.get("/", getHealth);

export default router;
`,
  "backend/src/routes/index.ts": `import { Router } from "express";
import healthRoutes from "./health.routes";

const router = Router();
router.use("/health", healthRoutes);

export default router;
`,
  "backend/src/middleware/not-found.middleware.ts": `import { Request, Response } from "express";

export function notFound(req: Request, res: Response) {
  return res.status(404).json({ message: \`Rota não encontrada: \${req.method} \${req.path}\` });
}
`,
  "backend/src/middleware/error.middleware.ts": `import { NextFunction, Request, Response } from "express";

export function errorHandler(error: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error(error);
  return res.status(500).json({ message: "Erro interno do servidor." });
}
`,
  "backend/src/app.ts": `import path from "node:path";
import compression from "compression";
import cors from "cors";
import express from "express";
import apiRoutes from "./routes";
import { errorHandler } from "./middleware/error.middleware";
import { notFound } from "./middleware/not-found.middleware";

const app = express();
const frontendPath = path.resolve(process.cwd(), "../frontend");

app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api", apiRoutes);
app.use(express.static(frontendPath));
app.get("/", (_req, res) => res.sendFile(path.join(frontendPath, "index.html")));
app.use(notFound);
app.use(errorHandler);

export default app;
`,
  "backend/src/server.ts": `import http from "node:http";
import app from "./app";
import { env } from "./config/env";

const server = http.createServer(app);

server.listen(env.port, () => {
  console.log(\`Servidor disponível em http://localhost:\${env.port}\`);
});
`,
  "backend/src/services/.gitkeep": "",
  "backend/src/repositories/.gitkeep": "",
  "backend/src/types/.gitkeep": "",
  "backend/tests/.gitkeep": "",
  "frontend/index.html": `<!doctype html>
<html lang="pt">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${projectTitle}" />
    <title>${projectTitle}</title>
    <link rel="stylesheet" href="/css/styles.css" />
    <script src="/js/main.js" defer></script>
  </head>
  <body>
    <main class="container">
      <p class="eyebrow">NOVO PROJETO</p>
      <h1>${projectTitle}</h1>
      <p>O frontend e o backend estão preparados para começar.</p>
      <div id="api-status" class="status">A verificar a API…</div>
    </main>
  </body>
</html>
`,
  "frontend/css/styles.css": `:root {
  color-scheme: dark;
  font-family: Inter, system-ui, sans-serif;
  background: #101010;
  color: #f3f3f3;
}

* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; }
.container { width: min(100% - 2rem, 720px); padding: 4rem 0; }
.eyebrow { color: #d8b467; font-size: .75rem; font-weight: 700; letter-spacing: .2em; }
h1 { margin: .75rem 0; font-size: clamp(2.5rem, 8vw, 5rem); }
p { color: #c9c3b8; line-height: 1.7; }
.status { margin-top: 2rem; border: 1px solid #393939; padding: 1rem; }
.status.is-online { border-color: #d8b467; color: #d8b467; }
`,
  "frontend/js/main.js": `const statusElement = document.querySelector("#api-status");

async function checkApi() {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) throw new Error("API indisponível");
    statusElement.textContent = "API ligada e pronta.";
    statusElement.classList.add("is-online");
  } catch {
    statusElement.textContent = "Não foi possível ligar à API.";
  }
}

checkApi();
`,
  "frontend/components/.gitkeep": "",
  "frontend/img/.gitkeep": "",
};

ensureSafeTarget(target);

console.log(`\nProjeto: ${projectTitle}`);
console.log(`Destino: ${target}\n`);

if (options.dryRun) {
  Object.keys(files).forEach((file) => console.log(`  + ${file}`));
  console.log("\nSimulação concluída. Nenhum ficheiro foi criado.");
  process.exit(0);
}

mkdirSync(target, { recursive: true });

for (const [relativePath, content] of Object.entries(files)) {
  const filePath = join(target, relativePath);
  mkdirSync(resolve(filePath, ".."), { recursive: true });
  writeFileSync(filePath, content, "utf8");
}

if (options.install) run("npm", ["install"], join(target, "backend"));
if (options.git) run("git", ["init"], target);

console.log("\nProjeto criado com sucesso.");
console.log(`\nPróximos passos:\n  cd "${join(target, "backend")}"`);
if (!options.install) console.log("  npm install");
console.log("  npm run dev\n");
