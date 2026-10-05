import supabase from "../config/supabase";
import { readAllRows } from "./pagination";

type RelatedService = { name: string; price: number | string };
type RelatedBarber = { id?: string; name: string };
type DashboardBooking = {
  id: string;
  barber_id: string;
  customer_name: string;
  starts_at: string;
  ends_at: string;
  status: "confirmed" | "cancelled" | "completed" | "no_show";
  services: RelatedService | RelatedService[] | null;
  barbers: RelatedBarber | RelatedBarber[] | null;
};

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function differenceInMinutes(start: string, end: string): number {
  return Math.max(0, (Date.parse(end) - Date.parse(start)) / 60_000);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function revenue(bookings: DashboardBooking[]): number {
  return roundMoney(bookings.reduce((total, booking) => total + Number(relation(booking.services)?.price ?? 0), 0));
}

export async function getBarberBookings(barberId: string, start: string, end: string) {
  return readAllRows((from, to) => supabase
    .from("bookings")
    .select("id, barber_id, customer_name, customer_email, customer_phone, starts_at, ends_at, status, services(name)")
    .eq("barber_id", barberId)
    .neq("status", "cancelled")
    .gte("starts_at", start)
    .lt("starts_at", end)
    .order("starts_at").order("id").range(from, to));
}

export async function getAdminBookings(start: string, end: string) {
  return readAllRows((from, to) => supabase
    .from("bookings")
    .select("id, barber_id, customer_name, customer_email, customer_phone, starts_at, ends_at, status, services(name, price), barbers(id, name)")
    .neq("status", "cancelled")
    .gte("starts_at", start)
    .lt("starts_at", end)
    .order("starts_at").order("id").range(from, to));
}

export async function cancelBooking(bookingId: string) {
  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .neq("status", "cancelled")
    .select("id, status")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getDashboardOverview({ todayStart, todayEnd, workingMinutesPerBarber }: {
  todayStart: string;
  todayEnd: string;
  workingMinutesPerBarber: number;
}) {
  const [bookingsResult, barbersResult] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, barber_id, customer_name, starts_at, ends_at, status, services(name, price), barbers(id, name)")
      .gte("starts_at", todayStart)
      .lt("starts_at", todayEnd)
      .order("starts_at"),
    supabase.from("barbers").select("id, name").order("created_at"),
  ]);
  if (bookingsResult.error) throw bookingsResult.error;
  if (barbersResult.error) throw barbersResult.error;

  const bookings = (bookingsResult.data ?? []) as unknown as DashboardBooking[];
  const barbers = barbersResult.data ?? [];
  const active = bookings.filter((booking) => !["cancelled", "no_show"].includes(booking.status));
  const bookedMinutes = active.reduce((total, booking) => total + differenceInMinutes(booking.starts_at, booking.ends_at), 0);
  const capacity = barbers.length * workingMinutesPerBarber;
  const services = new Map<string, { name: string; bookings: number }>();
  const team = new Map(barbers.map((barber) => [barber.id, { id: barber.id, name: barber.name, bookings: 0, bookedMinutes: 0 }]));

  for (const booking of active) {
    const serviceName = relation(booking.services)?.name || "Serviço";
    const service = services.get(serviceName) ?? { name: serviceName, bookings: 0 };
    service.bookings += 1;
    services.set(serviceName, service);
    const barber = team.get(booking.barber_id);
    if (barber) {
      barber.bookings += 1;
      barber.bookedMinutes += differenceInMinutes(booking.starts_at, booking.ends_at);
    }
  }

  return {
    summary: {
      todayBookings: active.length,
      occupancyToday: capacity ? Math.min(100, Math.round((bookedMinutes / capacity) * 100)) : 0,
      cancellationsToday: bookings.filter((booking) => booking.status === "cancelled").length,
      noShowsToday: bookings.filter((booking) => booking.status === "no_show").length,
    },
    services: [...services.values()].sort((left, right) => right.bookings - left.bookings),
    barbers: [...team.values()].sort((left, right) => right.bookings - left.bookings),
    upcoming: active.slice(0, 8).map((booking) => ({
      id: booking.id,
      customer_name: booking.customer_name,
      starts_at: booking.starts_at,
      service_name: relation(booking.services)?.name || "Serviço",
      barber_name: relation(booking.barbers)?.name || "Barbeiro",
    })),
  };
}

function monthKeys(startMonth: string, count: number): string[] {
  const [year, month] = startMonth.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 + index, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export async function getInvoicingOverview({ historyStart, rangeEnd, currentMonth, previousMonth }: {
  historyStart: string;
  rangeEnd: string;
  currentMonth: string;
  previousMonth: string;
}) {
  const data = await readAllRows((from, to) => supabase
    .from("bookings")
    .select("id, barber_id, starts_at, status, services(name, price), barbers(id, name)")
    .in("status", ["confirmed", "completed"])
    .gte("starts_at", historyStart)
    .lt("starts_at", rangeEnd)
    .order("starts_at").order("id").range(from, to));

  const bookings = (data ?? []) as unknown as DashboardBooking[];
  const current = bookings.filter((booking) => booking.starts_at.startsWith(currentMonth));
  const previous = bookings.filter((booking) => booking.starts_at.startsWith(previousMonth));
  const monthRevenue = revenue(current);
  const previousRevenue = revenue(previous);
  const services = new Map<string, { name: string; bookings: number; revenue: number }>();
  const barbers = new Map<string, { id: string; name: string; bookings: number; revenue: number }>();

  for (const booking of current) {
    const service = relation(booking.services);
    const price = Number(service?.price ?? 0);
    const serviceName = service?.name || "Serviço";
    const serviceTotal = services.get(serviceName) ?? { name: serviceName, bookings: 0, revenue: 0 };
    serviceTotal.bookings += 1;
    serviceTotal.revenue += price;
    services.set(serviceName, serviceTotal);
    const relatedBarber = relation(booking.barbers);
    const barberTotal = barbers.get(booking.barber_id) ?? { id: booking.barber_id, name: relatedBarber?.name || "Barbeiro", bookings: 0, revenue: 0 };
    barberTotal.bookings += 1;
    barberTotal.revenue += price;
    barbers.set(booking.barber_id, barberTotal);
  }

  const monthly = monthKeys(historyStart.slice(0, 7), 12).map((month) => {
    const monthBookings = bookings.filter((booking) => booking.starts_at.startsWith(month));
    return { month, bookings: monthBookings.length, revenue: revenue(monthBookings) };
  });

  return {
    summary: {
      monthRevenue,
      monthBookings: current.length,
      averageTicket: current.length ? roundMoney(monthRevenue / current.length) : 0,
      previousRevenue,
      percentageChange: previousRevenue ? Math.round(((monthRevenue - previousRevenue) / previousRevenue) * 1000) / 10 : null,
    },
    monthly,
    services: [...services.values()].map((item) => ({ ...item, revenue: roundMoney(item.revenue) })).sort((a, b) => b.revenue - a.revenue),
    barbers: [...barbers.values()].map((item) => ({ ...item, revenue: roundMoney(item.revenue) })).sort((a, b) => b.revenue - a.revenue),
  };
}
