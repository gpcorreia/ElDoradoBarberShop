const { randomBytes } = require("node:crypto");
const bcrypt = require("bcrypt");

async function main() {
  const password = randomBytes(18).toString("base64url");
  const jwtSecret = randomBytes(48).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  console.log("Guarda estes valores num gestor de palavras-passe e atualiza os ficheiros .env:");
  console.log(`\nADMIN_PASSWORD=${password}`);
  console.log(`ADMIN_PASSWORD_HASH=${passwordHash}`);
  console.log(`JWT_SECRET_KEY=${jwtSecret}\n`);
  console.log("Não guardes ADMIN_PASSWORD no .env; é apresentada apenas para poderes entrar.");
}

main().catch((error) => {
  console.error("Não foi possível gerar as credenciais:", error);
  process.exitCode = 1;
});
