const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const INFO_URL = "https://portal.bulkgate.com/api/2.0/advanced/info";
const SEND_URL = "https://portal.bulkgate.com/api/2.0/advanced/transactional";
const applicationId = process.env.BULKGATE_APPLICATION_ID?.trim();
const applicationToken = process.env.BULKGATE_APPLICATION_TOKEN?.trim();
const sendRealSms = process.argv.includes("--send");

if (!applicationId || !applicationToken) {
  console.error("Configura BULKGATE_APPLICATION_ID e BULKGATE_APPLICATION_TOKEN no backend/.env.");
  process.exit(1);
}

async function post(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.error) {
    throw new Error(result.error || result.type || `HTTP ${response.status}`);
  }
  return result;
}

function destination(phone) {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) throw new Error("TEST_SMS_PHONE não contém um número válido.");
  if (trimmed.startsWith("+")) return { number: digits };
  if (trimmed.startsWith("00")) return { number: digits.slice(2) };
  if (digits.startsWith("351") && digits.length === 12) return { number: digits };
  return { number: digits, country: (process.env.BULKGATE_COUNTRY || "pt").toLowerCase() };
}

function acceptedStatus(result) {
  const accepted = new Set(["accepted", "sent", "scheduled"]);
  if (accepted.has(result.data?.status)) return result.data.status;

  const rawResponses = result.data?.response;
  const responses = Array.isArray(rawResponses)
    ? rawResponses
    : rawResponses && typeof rawResponses === "object"
      ? Object.values(rawResponses)
      : [];
  const delivery = responses.find((item) => accepted.has(item?.status));
  if (delivery) return delivery.status;

  const totals = result.data?.total?.status;
  if (totals) {
    for (const status of accepted) {
      if (Number(totals[status] ?? 0) > 0) return status;
    }
  }

  if (result.data?.message_id || result.data?.sms_id) return "accepted";
  return null;
}

async function main() {
  const info = await post(INFO_URL, {
    application_id: applicationId,
    application_token: applicationToken,
  });
  console.log("Ligação ao BulkGate: OK");
  console.log(`Saldo: ${info.data?.credit ?? "indisponível"} ${info.data?.currency ?? ""}`.trim());
  console.log(`Mensagens gratuitas: ${info.data?.free_messages ?? "indisponível"}`);

  if (!sendRealSms) {
    console.log("Nenhum SMS enviado. Para um teste real, define TEST_SMS_PHONE e executa npm run test:sms -- --send.");
    return;
  }

  const phone = process.env.TEST_SMS_PHONE?.trim();
  if (!phone) throw new Error("Define TEST_SMS_PHONE no backend/.env antes do teste real.");

  const target = destination(phone);
  const sms = {
    text: "Teste ElDorado Barbershop: integração BulkGate ativa.",
    unicode: true,
    sender_id: process.env.BULKGATE_SENDER_ID?.trim() || "gSystem",
  };
  const senderValue = process.env.BULKGATE_SENDER_ID_VALUE?.trim();
  if (senderValue) sms.sender_id_value = senderValue;

  const result = await post(SEND_URL, {
    application_id: applicationId,
    application_token: applicationToken,
    number: target.number,
    ...(target.country ? { country: target.country } : {}),
    duplicates_check: "on",
    tag: "local-integration-test",
    channel: { sms },
  });
  const status = acceptedStatus(result);
  if (!status) throw new Error("O BulkGate respondeu sem confirmar a aceitação do SMS.");
  console.log(`SMS de teste aceite pelo BulkGate (${status}).`);
}

main().catch((error) => {
  console.error(`Teste BulkGate falhou: ${error.message}`);
  process.exitCode = 1;
});
