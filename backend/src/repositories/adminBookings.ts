import supabase from "../config/supabase";

export async function getBarberBookings(barberId: string, start: string, end: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, customer_name, customer_email, customer_phone, starts_at, ends_at, status, services(name)")
    .eq("barber_id", barberId)
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
