import supabase from "../config/supabase";

type RelatedService = {
  name: string;
  price: number | string;
};

type RelatedBarber = {
  id?: string;
  name: string;
};

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

function roundsToMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function getBarberBookings(barberId: string, start: string, end: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, barber_id, customer_name, customer_email, customer_phone, starts_at, ends_at, status, services(name)")
    .eq("barber_id", barberId)
    .neq("status", "cancelled")
    .gte("starts_at", start)
    .lt("starts_at", end)
    .order("starts_at");

  if (error) throw error;
  return data ?? [];
}

export async function getAdminBookings(start: string, end: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, barber_id, customer_name, customer_email, customer_phone, starts_at, ends_at, status, services(name, price), barbers(id, name)")
    .neq("status", "cancelled")
    .gte("starts_at", start)
    .lt("starts_at", end)
    .order("starts_at");

  if (error) throw error;
  return data ?? [];
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

export async function getDashboardOverview({
  todayStart,
  todayEnd,
  monthStart,
  monthEnd,
  workingMinutesPerBarber,
}: {
  todayStart: string;
  todayEnd: string;
  monthStart: string;
  monthEnd: string;
  workingMinutesPerBarber: number;
}) {
  const [bookingsResult, barbersResult] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, barber_id, customer_name, starts_at, ends_at, status, services(name, price), barbers(id, name)")
      .gte("starts_at", monthStart)
      .lt("starts_at", monthEnd)
      .order("starts_at"),
    supabase.from("barbers").select("id, name").order("created_at"),
  ]);

  if (bookingsResult.error) throw bookingsResult.error;
  if (barbersResult.error) throw barbersResult.error;

  const bookings = (bookingsResult.data ?? []) as unknown as DashboardBooking[];
  const barbers = barbersResult.data ?? [];
  const activeBookings = bookings.filter((booking) => booking.status !== "cancelled");
  const revenueBookings = bookings.filter((booking) => booking.status === "confirmed");
  const todayBookings = activeBookings.filter((booking) => booking.starts_at >= todayStart && booking.starts_at < todayEnd);
  const todayRevenueBookings = revenueBookings.filter((booking) => booking.starts_at >= todayStart && booking.starts_at < todayEnd);
  const totalBookings = bookings.length;
  const cancelledBookings = bookings.filter((booking) => booking.status === "cancelled").length;
  const todayBookedMinutes = todayBookings.reduce(
    (total, booking) => total + differenceInMinutes(booking.starts_at, booking.ends_at),
    0
  );
  const totalCapacity = barbers.length * workingMinutesPerBarber;
  const revenue = (items: DashboardBooking[]) => roundsToMoney(items.reduce(
    (total, booking) => total + Number(relation(booking.services)?.price ?? 0),
    0
  ));

  const serviceMap = new Map<string, { name: string; bookings: number; revenue: number }>();
  for (const booking of revenueBookings) {
    const service = relation(booking.services);
    const name = service?.name || "Serviço";
    const current = serviceMap.get(name) ?? { name, bookings: 0, revenue: 0 };
    current.bookings += 1;
    current.revenue += Number(service?.price ?? 0);
    serviceMap.set(name, current);
  }

  const barberMap = new Map(barbers.map((barber) => [barber.id, {
    id: barber.id,
    name: barber.name,
    bookings: 0,
    revenue: 0,
  }]));
  for (const booking of revenueBookings) {
    const barber = barberMap.get(booking.barber_id);
    if (!barber) continue;
    barber.bookings += 1;
    barber.revenue += Number(relation(booking.services)?.price ?? 0);
  }

  const dayMap = new Map<string, { date: string; bookings: number; revenue: number }>();
  for (const booking of revenueBookings) {
    const date = booking.starts_at.slice(0, 10);
    const current = dayMap.get(date) ?? { date, bookings: 0, revenue: 0 };
    current.bookings += 1;
    current.revenue += Number(relation(booking.services)?.price ?? 0);
    dayMap.set(date, current);
  }

  return {
    summary: {
      todayBookings: todayBookings.length,
      todayRevenue: revenue(todayRevenueBookings),
      monthBookings: activeBookings.length,
      monthRevenue: revenue(revenueBookings),
      cancellationRate: totalBookings ? Math.round((cancelledBookings / totalBookings) * 100) : 0,
      occupancyToday: totalCapacity ? Math.min(100, Math.round((todayBookedMinutes / totalCapacity) * 100)) : 0,
    },
    services: [...serviceMap.values()]
      .map((service) => ({ ...service, revenue: roundsToMoney(service.revenue) }))
      .sort((a, b) => b.bookings - a.bookings),
    barbers: [...barberMap.values()]
      .map((barber) => ({ ...barber, revenue: roundsToMoney(barber.revenue) }))
      .sort((a, b) => b.bookings - a.bookings),
    daily: [...dayMap.values()]
      .map((day) => ({ ...day, revenue: roundsToMoney(day.revenue) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
