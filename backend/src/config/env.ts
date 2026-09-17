const isProduction = process.env.NODE_ENV === "production";

const requiredVariables = [
  "SUPABASE_URL",
  "SUPABASE_KEY",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD_HASH",
  "JWT_SECRET_KEY",
  "APP_ORIGIN",
] as const;

const missingVariables = requiredVariables.filter((name) => !process.env[name]?.trim());
if (missingVariables.length) {
  throw new Error(`Variáveis de ambiente em falta: ${missingVariables.join(", ")}`);
}

function positiveInteger(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} deve ser um número inteiro positivo.`);
  }

  return value;
}

function validOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    throw new Error("APP_ORIGIN deve ser uma origem válida, por exemplo http://localhost:1000.");
  }
}

const jwtSecret = process.env.JWT_SECRET_KEY!.trim();
const adminEmail = process.env.ADMIN_EMAIL!.trim().toLowerCase();
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH!.trim();
const adminSessionMaxAgeMs = positiveInteger("ADMIN_SESSION_MAX_AGE_MS", 8 * 60 * 60 * 1000);
const port = positiveInteger("PORT", 1000);

if (port > 65535) throw new Error("PORT deve estar entre 1 e 65535.");
if (jwtSecret.length < 32) throw new Error("JWT_SECRET_KEY deve ter pelo menos 32 caracteres aleatórios.");
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) throw new Error("ADMIN_EMAIL deve ser válido.");
if (!/^\$2[aby]\$\d{2}\$.{53}$/.test(adminPasswordHash)) {
  throw new Error("ADMIN_PASSWORD_HASH deve ser um hash bcrypt válido.");
}

const gmailUser = process.env.GMAIL_USER?.trim() ?? "";
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.trim() ?? "";
const contactToEmail = process.env.CONTACT_TO_EMAIL?.trim() || gmailUser;
const emailConfigured = Boolean(gmailUser && gmailAppPassword && contactToEmail);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if ((gmailUser || gmailAppPassword || contactToEmail) && !emailConfigured) {
  throw new Error("Para ativar notificações, configura GMAIL_USER, GMAIL_APP_PASSWORD e CONTACT_TO_EMAIL.");
}
if (emailConfigured && (!emailPattern.test(gmailUser) || !emailPattern.test(contactToEmail))) {
  throw new Error("GMAIL_USER e CONTACT_TO_EMAIL devem ser endereços de email válidos.");
}

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction,
  port,
  trustProxy: process.env.TRUST_PROXY === "true" || isProduction,
  appOrigin: validOrigin(process.env.APP_ORIGIN!),
  servePages: process.env.SERVE_PAGES !== "false",
  supabaseUrl: process.env.SUPABASE_URL!.trim(),
  supabaseKey: process.env.SUPABASE_KEY!.trim(),
  adminEmail,
  adminPasswordHash,
  jwtSecret,
  jwtIssuer: process.env.JWT_ISSUER?.trim() || "eldorado-barbershop",
  jwtAudience: process.env.JWT_AUDIENCE?.trim() || "eldorado-admin",
  adminSessionMaxAgeMs,
  gmailUser,
  gmailAppPassword,
  contactToEmail,
  emailConfigured,
});
