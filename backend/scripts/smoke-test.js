const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:1000";
const checkDatabase = process.env.SMOKE_DATABASE === "true";

async function expect(path, expectedStatus, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual", ...options });
  if (response.status !== expectedStatus) {
    const body = await response.text();
    throw new Error(`${path}: esperado ${expectedStatus}, recebido ${response.status}. ${body.slice(0, 200)}`);
  }
  console.log(`✓ ${path} → ${response.status}`);
  return response;
}

async function main() {
  await expect("/api/health", 200);
  await expect("/", 200);
  await expect("/admin", 303);
  await expect("/api/admin/session", 401);
  await expect("/pagina-inexistente", 404);

  if (checkDatabase) {
    await expect("/api/barbers", 200);
    await expect("/api/services", 200);
    await expect("/api/products", 200);
  }

  console.log("\nSmoke test concluído com sucesso.");
}

main().catch((error) => {
  console.error(`\nSmoke test falhou: ${error.message}`);
  process.exitCode = 1;
});
