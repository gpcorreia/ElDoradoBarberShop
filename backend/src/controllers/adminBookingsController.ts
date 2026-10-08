import { updateBooking } from "../repositories/bookingRepository";
import { Request, Response } from "express";
import { cancelBooking, getAdminBookings, getBarberBookings, getDashboardOverview, getInvoicingOverview } from "../repositories/adminBookings";
import { isLocalTimestamp, isUuid, lisbonLocalTimestamp } from "../config/validation";
import { WORKING_PERIODS } from "../config/constants";

function addUtcDays(localTimestamp: string, days: number): string {
  const date = new Date(`${localTimestamp}Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 19);
}

function nextMonthStart(monthStart: string): string {
  const date = new Date(`${monthStart}Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 19);
}

function minutes(time: string): number {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

export async function handleGetBarberBookings(req: Request, res: Response) {
  const start = String(req.query.start ?? "");
  const end = String(req.query.end ?? "");

  const rangeMilliseconds = Date.parse(end) - Date.parse(start);
  if (!isUuid(req.params.barberId) || !isLocalTimestamp(start) || !isLocalTimestamp(end) || start >= end || rangeMilliseconds > 31 * 24 * 60 * 60 * 1000) {
    return res.status(400).json({ message: "O intervalo da agenda é inválido." });
  }

  try {
    const bookings = await getBarberBookings(req.params.barberId, start, end);
    return res.status(200).json({ bookings });
  } catch (error) {
    console.error("Erro ao procurar reservas do barbeiro:", error);
    return res.status(500).json({ message: "Não foi possível carregar as reservas." });
  }
}

export async function handleGetAdminBookings(req: Request, res: Response) {
  const start = String(req.query.start ?? "");
  const end = String(req.query.end ?? "");
  const rangeMilliseconds = Date.parse(end) - Date.parse(start);

  if (!isLocalTimestamp(start) || !isLocalTimestamp(end) || start >= end || rangeMilliseconds > 62 * 24 * 60 * 60 * 1000) {
    return res.status(400).json({ message: "O intervalo de reservas é inválido." });
  }

  try {
    const bookings = await getAdminBookings(start, end);
    return res.status(200).json({ bookings });
  } catch (error) {
    console.error("Erro ao procurar reservas administrativas:", error);
    return res.status(500).json({ message: "Não foi possível carregar as reservas." });
  }
}

export async function handleCancelBooking(req: Request, res: Response) {
  if (!isUuid(req.params.bookingId)) {
    return res.status(400).json({ message: "O identificador da reserva é inválido." });
  }

  try {
    const booking = await cancelBooking(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: "Reserva não encontrada ou já cancelada." });
    return res.status(200).json({ message: "Reserva cancelada com sucesso.", booking });
  } catch (error) {
    console.error("Erro ao cancelar reserva:", error);
    return res.status(500).json({ message: "Não foi possível cancelar a reserva." });
  }
}

export async function handleGetDashboardOverview(_req: Request, res: Response) {
  const now = lisbonLocalTimestamp();
  const today = now.slice(0, 10);
  const todayStart = `${today}T00:00:00`;
  const workingMinutesPerBarber = WORKING_PERIODS.reduce(
    (total, period) => total + minutes(period.end) - minutes(period.start),
    0
  );

  try {
    const overview = await getDashboardOverview({
      todayStart,
      todayEnd: addUtcDays(todayStart, 1),
      workingMinutesPerBarber,
    });
    return res.status(200).json({ overview });
  } catch (error) {
    console.error("Erro ao carregar o dashboard:", error);
    return res.status(500).json({ message: "Não foi possível carregar os indicadores do dashboard." });
  }
}

export async function handleGetInvoicingOverview(_req: Request, res: Response) {
  const currentMonth = lisbonLocalTimestamp().slice(0, 7);
  const currentStart = `${currentMonth}-01T00:00:00`;
  const previousDate = new Date(`${currentStart}Z`);
  previousDate.setUTCMonth(previousDate.getUTCMonth() - 1);
  const historyDate = new Date(`${currentStart}Z`);
  historyDate.setUTCMonth(historyDate.getUTCMonth() - 11);

  try {
    const invoicing = await getInvoicingOverview({
      historyStart: historyDate.toISOString().slice(0, 19),
      rangeEnd: nextMonthStart(currentStart),
      currentMonth,
      previousMonth: previousDate.toISOString().slice(0, 7),
    });
    return res.status(200).json({ invoicing });
  } catch (error) {
    console.error("Erro ao carregar a faturação:", error);
    return res.status(500).json({ message: "Não foi possível carregar os dados de faturação." });
  }
}

export async function handleUpdateBooking(req: Request, res: Response) {
  const { service_id, starts_at, expected_starts_at, expected_service_id } = req.body ?? {};
  if (!isUuid(req.params.bookingId) || !isUuid(service_id) || !isUuid(expected_service_id)
    || !isLocalTimestamp(starts_at) || !isLocalTimestamp(expected_starts_at)
    || new Date(starts_at.slice(0, 10) + "T12:00:00Z").getUTCDay() === 0) {
    return res.status(400).json({ message: "Serviço ou horário inválidos." });
  }
  try {
    const result = await updateBooking(req.params.bookingId, service_id, starts_at, expected_starts_at, expected_service_id);
    if (result.outcome === "invalid") return res.status(400).json({ message: "O serviço não cabe no horário de funcionamento." });
    if (result.outcome === "conflict") return res.status(409).json({ message: "O novo horário sobrepõe-se a outra reserva. Escolhe outro horário." });
    if (result.outcome === "stale") return res.status(409).json({ message: "A reserva foi alterada ou já não pode ser editada. Fecha os detalhes e atualiza a lista." });
    return res.json({ message: "Reserva atualizada com sucesso.", booking: result.booking });
  } catch (error) {
    console.error("Erro ao atualizar reserva:", error);
    return res.status(500).json({ message: "Não foi possível atualizar a reserva." });
  }
}
