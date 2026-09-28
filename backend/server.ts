import http from "http";
import app from "./index";
import { env } from "./src/config/env";

const server = http.createServer(app);

server.listen(env.port, () => {
  console.log(`Servidor disponível em http://localhost:${env.port}`);
});

server.requestTimeout = 30_000;
server.headersTimeout = 35_000;
server.keepAliveTimeout = 5_000;

function shutdown(signal: string) {
  console.log(`${signal} recebido. A terminar o servidor...`);
  server.close((error) => {
    if (error) {
      console.error("Erro ao terminar o servidor:", error);
      process.exitCode = 1;
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
