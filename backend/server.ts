import http from "http";
import app from "./index";

const configuredPort = Number(process.env.PORT ?? 1000);
const port = Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort <= 65535
  ? configuredPort
  : 1000;

const server = http.createServer(app);

server.listen(port, () => {
  console.log(`Servidor disponível em http://localhost:${port}`);
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
