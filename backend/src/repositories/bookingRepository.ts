import supabase from "../config/supabase";
import { SLOT_INTERVAL_MINUTES, WORKING_PERIODS } from "../config/constants";
import { lisbonLocalTimestamp } from "../config/validation";
import { BookingRequestBody } from "../types/data";

export type Appointment = {
  starts_at: string;
  ends_at: string;
};

export type CreateBookingResult = "created" | "conflict" | "invalid" | "error";

const serviceDurationCache = new Map<string, { duration: number; expiresAt: number }>();
const CATALOG_CACHE_MS = 5 * 60 * 1000;

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

function getTimeFromTimestamp(timestamp: string): string {
  return timestamp.slice(11, 16);
}

function calculateEndTime(startsAt: string, durationMinutes: number): string | null {
  const date = startsAt.slice(0, 10);
  const startMinutes = timeToMinutes(getTimeFromTimestamp(startsAt));
  const endMinutes = startMinutes + durationMinutes;
  if (endMinutes >= 24 * 60) return null;
  return `${date}T${minutesToTime(endMinutes)}:00`;
}

function fitsWorkingPeriod(startMinutes: number, durationMinutes: number): boolean {
  return WORKING_PERIODS.some((period) => {
    const periodStart = timeToMinutes(period.start);
    const periodEnd = timeToMinutes(period.end);
    return startMinutes >= periodStart && startMinutes + durationMinutes <= periodEnd;
  });
}

export async function getServiceDuration(serviceId: string): Promise<number | null> {
  const cached = serviceDurationCache.get(serviceId);
  if (cached && cached.expiresAt > Date.now()) return cached.duration;

  const { data, error } = await supabase
    .from("services")
    .select("duration_minutes")
    .eq("id", serviceId)
    .maybeSingle();

  if (error) throw error;
  const duration = Number(data?.duration_minutes);
  if (!Number.isInteger(duration) || duration <= 0) return null;

  serviceDurationCache.set(serviceId, { duration, expiresAt: Date.now() + CATALOG_CACHE_MS });
  return duration;
}

export async function getServiceName(serviceId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("services")
    .select("name")
    .eq("id", serviceId)
    .maybeSingle();

  if (error) throw error;
  return typeof data?.name === "string" ? data.name : null;
}

export async function createBooking(bookingInfo: BookingRequestBody): Promise<CreateBookingResult> {
  let durationMinutes: number | null;
  try {
    durationMinutes = await getServiceDuration(bookingInfo.service_id);
  } catch (error) {
    console.error("Erro ao procurar o serviço:", error);
    return "error";
  }

  if (!durationMinutes) return "invalid";

  const startMinutes = timeToMinutes(getTimeFromTimestamp(bookingInfo.starts_at));
  if (startMinutes % SLOT_INTERVAL_MINUTES !== 0 || !fitsWorkingPeriod(startMinutes, durationMinutes)) {
    return "invalid";
  }

  const endsAt = calculateEndTime(bookingInfo.starts_at, durationMinutes);
  if (!endsAt) return "invalid";

  const { error } = await supabase.from("bookings").insert({
    barber_id: bookingInfo.barber_id,
    service_id: bookingInfo.service_id,
    customer_name: bookingInfo.customer_name,
    customer_email: bookingInfo.customer_email || null,
    customer_phone: bookingInfo.customer_phone,
    starts_at: bookingInfo.starts_at,
    ends_at: endsAt,
    status: "confirmed",
  });

  if (!error) return "created";
  if (error.code === "23P01") return "conflict";
  if (error.code === "23503" || error.code === "23514" || error.code === "22P02") return "invalid";

  console.error("Erro ao criar a marcação:", error);
  return "error";
}

export async function getBookedAppointments(barberId: string, day: string): Promise<Appointment[]> {
  const dayStart = `${day}T00:00:00`;
  const nextDay = new Date(`${day}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const dayEnd = nextDay.toISOString().slice(0, 19);

  const { data: appointments, error } = await supabase
    .from("bookings")
    .select("starts_at, ends_at")
    .eq("barber_id", barberId)
    .neq("status", "cancelled")
    .gte("starts_at", dayStart)
    .lt("starts_at", dayEnd);

  if (error) throw error;

  return (appointments ?? []) as Appointment[];
}

export function calculateAvailableSlots(
  appointments: Appointment[],
  day: string,
  durationMinutes: number,
  includePast = false
): string[] {
  const bookedSlots = appointments.map((appointment) => ({
    start: timeToMinutes(getTimeFromTimestamp(appointment.starts_at)),
    end: timeToMinutes(getTimeFromTimestamp(appointment.ends_at)),
  }));
  const currentLocalTime = lisbonLocalTimestamp();
  const availableSlots: string[] = [];

  for (const period of WORKING_PERIODS) {
    const periodEnd = timeToMinutes(period.end);

    for (
      let currentMinutes = timeToMinutes(period.start);
      currentMinutes + durationMinutes <= periodEnd;
      currentMinutes += SLOT_INTERVAL_MINUTES
    ) {
      const currentTime = minutesToTime(currentMinutes);
      if (!includePast && `${day}T${currentTime}:00` <= currentLocalTime) continue;

      const slotEnd = currentMinutes + durationMinutes;
      const overlaps = bookedSlots.some((booked) => currentMinutes < booked.end && slotEnd > booked.start);
      if (!overlaps) availableSlots.push(currentTime);
    }
  }

  return availableSlots;
}

export async function getServices() {
  const { data, error } = await supabase
    .from("services")
    .select("id, name, description, price, duration_minutes")
    .order("created_at");

  if (error) throw error;

  const services = data ?? [];
  const expiresAt = Date.now() + CATALOG_CACHE_MS;
  for (const service of services) {
    const duration = Number(service.duration_minutes);
    if (Number.isInteger(duration) && duration > 0) {
      serviceDurationCache.set(service.id, { duration, expiresAt });
    }
  }

  return services;
}

export async function updateBooking(bookingId: string, serviceId: string, startsAt: string, expectedStart: string, expectedService: string) {
  const duration = await getServiceDuration(serviceId);
  const startMinutes = timeToMinutes(getTimeFromTimestamp(startsAt));
  if (!duration || startMinutes % SLOT_INTERVAL_MINUTES !== 0 || !fitsWorkingPeriod(startMinutes, duration)) return { outcome: "invalid" };
  const endsAt = calculateEndTime(startsAt, duration);
  if (!endsAt) return { outcome: "invalid" };
  const { data, error } = await supabase.from("bookings")
    .update({ service_id: serviceId, starts_at: startsAt, ends_at: endsAt })
    .eq("id", bookingId).eq("starts_at", expectedStart).eq("service_id", expectedService)
    .in("status", ["confirmed", "completed"])
    .select("id, service_id, barber_id, starts_at, ends_at, status").maybeSingle();
  if (error?.code === "23P01") return { outcome: "conflict" };
  if (["23503", "23514", "22P02"].includes(error?.code ?? "")) return { outcome: "invalid" };
  if (error) throw error;
  return data ? { outcome: "updated", booking: data } : { outcome: "stale" };
}
