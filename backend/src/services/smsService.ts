import { env } from "../config/env";
import { BookingRequestBody } from "../types/data";

const BULKGATE_TRANSACTIONAL_URL = "https://portal.bulkgate.com/api/2.0/advanced/transactional";
const BULKGATE_TIMEOUT_MS = 10_000;

type BookingConfirmationDetails = {
  barberName: string;
  serviceName: string;
};

type BulkGateResponse = {
  data?: {
    status?: string;
    message_id?: string;
    sms_id?: string;
    total?: {
      status?: Record<string, number>;
    };
    response?: Array<{
      status?: string;
      message_id?: string;
      sms_id?: string;
    }> | Record<string, {
      status?: string;
      message_id?: string;
      sms_id?: string;
    }>;
  };
  type?: string;
  code?: number;
  error?: string;
  detail?: unknown;
};

function recipient(phone: string): { number: string; country?: string } {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (!digits) throw new Error("O número de telefone da reserva é inválido.");
  if (trimmed.startsWith("+")) return { number: digits };
  if (trimmed.startsWith("00")) return { number: digits.slice(2) };

  // Números portugueses já escritos com 351 não precisam de prefixo adicional.
  if (env.bulkGateCountry === "pt" && digits.startsWith("351") && digits.length === 12) {
    return { number: digits };
  }

  return { number: digits, country: env.bulkGateCountry };
}

function formatBookingDate(startsAt: string): { date: string; time: string } {
  const [rawDate, rawTime = ""] = startsAt.split("T");
  const date = new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${rawDate}T12:00:00Z`));

  return { date, time: rawTime.slice(0, 5) };
}

function compact(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function confirmationText(booking: BookingRequestBody, details: BookingConfirmationDetails): string {
  const { time } = formatBookingDate(booking.starts_at);
  const customerName = compact(booking.customer_name.split(/\s+/)[0], 11);
  const barberName = compact(details.barberName.split(/\s+/)[0], 11);
  return `Olá ${customerName}, marcação amanhã às ${time} com ${barberName}. Até breve!`;
}

function lisbonLocalToUtc(localTimestamp: string): Date {
  const [rawDate, rawTime] = localTimestamp.split("T");
  const [year, month, day] = rawDate.split("-").map(Number);
  const [hour, minute, second] = rawTime.split(":").map(Number);
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let instant = targetAsUtc;

  // Duas iterações acomodam a diferença de UTC e as mudanças de horário em Lisboa.
  for (let index = 0; index < 2; index += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Lisbon",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(instant));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const representedAsUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    );
    instant += targetAsUtc - representedAsUtc;
  }

  return new Date(instant);
}

function reminderSchedule(startsAt: string): string | undefined {
  const appointment = lisbonLocalToUtc(startsAt);
  const reminder = new Date(appointment.getTime() - env.bulkGateReminderHours * 60 * 60 * 1000);
  return reminder.getTime() > Date.now() ? reminder.toISOString() : undefined;
}

function acceptedStatus(result: BulkGateResponse): string | null {
  const acceptedStatuses = new Set(["accepted", "sent", "scheduled"]);
  if (result.data?.status && acceptedStatuses.has(result.data.status)) return result.data.status;

  const rawResponses = result.data?.response;
  const responses = Array.isArray(rawResponses)
    ? rawResponses
    : rawResponses && typeof rawResponses === "object"
      ? Object.values(rawResponses)
      : [];
  const acceptedResponse = responses.find((item) => item.status && acceptedStatuses.has(item.status));
  if (acceptedResponse?.status) return acceptedResponse.status;

  const totals = result.data?.total?.status;
  if (totals) {
    for (const status of acceptedStatuses) {
      if (Number(totals[status] ?? 0) > 0) return status;
    }
  }

  if (result.data?.message_id || result.data?.sms_id) return "accepted";
  return null;
}

export async function scheduleBookingSmsReminder(
  booking: BookingRequestBody,
  details: BookingConfirmationDetails
): Promise<void> {
  if (!env.bulkGateConfigured) return;

  const destination = recipient(booking.customer_phone);
  const schedule = reminderSchedule(booking.starts_at);
  const smsChannel: Record<string, string | boolean> = {
    text: confirmationText(booking, details),
    unicode: true,
    sender_id: env.bulkGateSenderId,
  };
  if (env.bulkGateSenderIdValue) smsChannel.sender_id_value = env.bulkGateSenderIdValue;

  const response = await fetch(BULKGATE_TRANSACTIONAL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      application_id: env.bulkGateApplicationId,
      application_token: env.bulkGateApplicationToken,
      number: destination.number,
      ...(destination.country ? { country: destination.country } : {}),
      ...(schedule ? { schedule } : {}),
      duplicates_check: "on",
      tag: "booking-reminder",
      channel: { sms: smsChannel },
    }),
    signal: AbortSignal.timeout(BULKGATE_TIMEOUT_MS),
  });

  const result = await response.json().catch(() => ({})) as BulkGateResponse;
  if (!response.ok || !acceptedStatus(result)) {
    const reason = result.error || result.type || `HTTP ${response.status}`;
    throw new Error(`O BulkGate recusou o SMS: ${reason}.`);
  }
}
