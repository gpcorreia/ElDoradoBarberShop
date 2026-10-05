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
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid origin");
    return url.origin;
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
const gmailApiClientId = process.env.GMAIL_API_CLIENT_ID?.trim() ?? "";
const gmailApiClientSecret = process.env.GMAIL_API_CLIENT_SECRET?.trim() ?? "";
const gmailApiRefreshToken = process.env.GMAIL_API_REFRESH_TOKEN?.trim() ?? "";
const contactToEmail = process.env.CONTACT_TO_EMAIL?.trim() || gmailUser;
const gmailApiValues = [gmailApiClientId, gmailApiClientSecret, gmailApiRefreshToken];
const gmailApiConfigured = Boolean(gmailUser && contactToEmail && gmailApiValues.every(Boolean));
const gmailSmtpConfigured = Boolean(gmailUser && gmailAppPassword && contactToEmail);
const emailConfigured = gmailApiConfigured || gmailSmtpConfigured;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const bulkGateApplicationId = process.env.BULKGATE_APPLICATION_ID?.trim() ?? "";
const bulkGateApplicationToken = process.env.BULKGATE_APPLICATION_TOKEN?.trim() ?? "";
const bulkGateSenderId = process.env.BULKGATE_SENDER_ID?.trim() || "gSystem";
const bulkGateSenderIdValue = process.env.BULKGATE_SENDER_ID_VALUE?.trim() ?? "";
const bulkGateCountry = (process.env.BULKGATE_COUNTRY?.trim() || "pt").toLowerCase();
const bulkGateReminderHours = positiveInteger("BULKGATE_REMINDER_HOURS", 24);
const bulkGateConfigured = Boolean(bulkGateApplicationId && bulkGateApplicationToken);
const bulkGateSenderIds = /^(gSystem|gShort|gText|gMobile|gPush|gOwn|gProfile|\d+)$/;

if (gmailApiValues.some(Boolean) && !gmailApiValues.every(Boolean)) {
  throw new Error("Para usar a Gmail API, configura GMAIL_API_CLIENT_ID, GMAIL_API_CLIENT_SECRET e GMAIL_API_REFRESH_TOKEN.");
}
if ((gmailAppPassword || gmailApiValues.some(Boolean)) && (!gmailUser || !contactToEmail)) {
  throw new Error("Para ativar notificações, configura também GMAIL_USER e CONTACT_TO_EMAIL.");
}
if ((gmailUser || gmailAppPassword || gmailApiValues.some(Boolean) || process.env.CONTACT_TO_EMAIL?.trim()) && !emailConfigured) {
  throw new Error("Configura a Gmail API ou, fora do Render gratuito, uma GMAIL_APP_PASSWORD.");
}
if (emailConfigured && (!emailPattern.test(gmailUser) || !emailPattern.test(contactToEmail))) {
  throw new Error("GMAIL_USER e CONTACT_TO_EMAIL devem ser endereços de email válidos.");
}
if (Boolean(bulkGateApplicationId) !== Boolean(bulkGateApplicationToken)) {
  throw new Error("BULKGATE_APPLICATION_ID e BULKGATE_APPLICATION_TOKEN devem ser configurados em conjunto.");
}
if (!bulkGateSenderIds.test(bulkGateSenderId)) {
  throw new Error("BULKGATE_SENDER_ID não é um tipo de remetente BulkGate válido.");
}
if (bulkGateSenderId !== "gSystem" && !bulkGateSenderIdValue) {
  throw new Error("BULKGATE_SENDER_ID_VALUE é obrigatório para o remetente BulkGate selecionado.");
}
if (bulkGateSenderId === "gText" && bulkGateSenderIdValue.length > 11) {
  throw new Error("BULKGATE_SENDER_ID_VALUE pode ter no máximo 11 caracteres quando BULKGATE_SENDER_ID=gText.");
}
if (!/^[a-z]{2}$/.test(bulkGateCountry)) {
  throw new Error("BULKGATE_COUNTRY deve ser um código ISO de duas letras, por exemplo pt.");
}
if (bulkGateReminderHours > 168) {
  throw new Error("BULKGATE_REMINDER_HOURS não pode ser superior a 168 horas.");
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
  gmailApiClientId,
  gmailApiClientSecret,
  gmailApiRefreshToken,
  gmailApiConfigured,
  gmailSmtpConfigured,
  contactToEmail,
  emailConfigured,
  bulkGateApplicationId,
  bulkGateApplicationToken,
  bulkGateSenderId,
  bulkGateSenderIdValue,
  bulkGateCountry,
  bulkGateReminderHours,
  bulkGateConfigured,
});
