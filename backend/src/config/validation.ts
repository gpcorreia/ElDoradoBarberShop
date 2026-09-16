import { ISO_DATE_PATTERN, LOCAL_TIMESTAMP_PATTERN, UUID_PATTERN } from "./constants";

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isLocalTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !LOCAL_TIMESTAMP_PATTERN.test(value)) return false;
  return isIsoDate(value.slice(0, 10));
}

export function isEmail(value: string): boolean {
  return value.length <= 150 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isPhone(value: string): boolean {
  return value.length >= 6 && value.length <= 20 && /^[+\d][\d\s().-]+$/.test(value);
}

export function lisbonLocalTimestamp(): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
}
