export const ADMIN_COOKIE_NAME = "eldorado_session";
export const ADMIN_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
export const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const LOCAL_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;

export const WORKING_PERIODS = [
  { start: "09:00", end: "12:00" },
  { start: "14:00", end: "19:00" },
] as const;

export const SLOT_INTERVAL_MINUTES = 10;
