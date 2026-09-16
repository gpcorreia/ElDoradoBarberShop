import { Request, Response } from "express";
import { cancelBooking, getBarberBookings } from "../repositories/adminBookings";
import { isLocalTimestamp, isUuid } from "../config/validation";

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
