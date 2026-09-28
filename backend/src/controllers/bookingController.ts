import { Request, Response } from "express";
import { createBooking, getAppointmentsAvailable, getServiceDuration, getServiceName, getServices } from "../repositories/bookingRepository";
import { barberExists, getBarberName, getBarbers } from "../repositories/barbers";
import { BookingRequestBody } from "../types/data";
import { isEmail, isIsoDate, isLocalTimestamp, isPhone, isUuid, lisbonLocalTimestamp } from "../config/validation";
import { sendBookingConfirmation } from "../services/emailService";

function isSunday(day: string): boolean {
  return new Date(`${day}T12:00:00Z`).getUTCDay() === 0;
}

export async function handleBooking(req: Request, res: Response) {
  const bookingInfo: BookingRequestBody = {
    barber_id: String(req.body?.barber_id ?? ""),
    service_id: String(req.body?.service_id ?? ""),
    customer_name: String(req.body?.customer_name ?? "").trim(),
    customer_email: String(req.body?.customer_email ?? "").trim().toLowerCase(),
    customer_phone: String(req.body?.customer_phone ?? "").trim(),
    starts_at: String(req.body?.starts_at ?? ""),
  };

  const day = bookingInfo.starts_at.slice(0, 10);
  const valid = isUuid(bookingInfo.barber_id)
    && isUuid(bookingInfo.service_id)
    && bookingInfo.customer_name.length >= 2
    && bookingInfo.customer_name.length <= 100
    && isEmail(bookingInfo.customer_email)
    && isPhone(bookingInfo.customer_phone)
    && isLocalTimestamp(bookingInfo.starts_at)
    && bookingInfo.starts_at > lisbonLocalTimestamp()
    && !isSunday(day);

  if (!valid) {
    return res.status(400).json({ message: "Os dados da marcação são inválidos ou o horário já passou." });
  }

  const result = await createBooking(bookingInfo);
  if (result === "conflict") {
    return res.status(409).json({
      message: "Este horário acabou de ser reservado. Escolhe outro horário disponível.",
    });
  }
  if (result === "invalid") {
    return res.status(400).json({ message: "O barbeiro, serviço ou horário selecionado é inválido." });
  }
  if (result === "error") {
    return res.status(500).json({ message: "Não foi possível concluir a marcação. Tenta novamente." });
  }

  try {
    const [barberName, serviceName] = await Promise.all([
      getBarberName(bookingInfo.barber_id),
      getServiceName(bookingInfo.service_id),
    ]);

    if (!barberName || !serviceName) throw new Error("Não foi possível obter os dados da marcação.");
    await sendBookingConfirmation(bookingInfo, { barberName, serviceName });
  } catch (error) {
    console.error("A marcação foi criada, mas o email de confirmação ao cliente falhou:", error);
  }

  return res.status(201).json({ message: "Marcação criada com sucesso." });
}

export async function searchAppointmentsAvailable(req: Request, res: Response) {
  const barberId = String(req.params.barber_id ?? "");
  const day = String(req.params.day ?? "");
  const serviceId = String(req.query.service_id ?? "");

  if (!isUuid(barberId) || !isUuid(serviceId) || !isIsoDate(day) || isSunday(day)) {
    return res.status(400).json({ message: "Barbeiro, serviço ou data inválidos." });
  }

  try {
    const [duration, validBarber] = await Promise.all([
      getServiceDuration(serviceId),
      barberExists(barberId),
    ]);
    if (!duration || !validBarber) return res.status(404).json({ message: "Barbeiro ou serviço não encontrado." });

    const appointments = await getAppointmentsAvailable(barberId, day, duration);
    return res.status(200).json({ appointments });
  } catch (error) {
    console.error("Erro ao procurar horários:", error);
    return res.status(500).json({ message: "Não foi possível carregar os horários disponíveis." });
  }
}

export async function handleGetBarbers(_req: Request, res: Response) {
  try {
    return res.status(200).json({ barbers: await getBarbers() });
  } catch (error) {
    console.error("Erro ao procurar barbeiros:", error);
    return res.status(500).json({ message: "Erro ao procurar barbeiros." });
  }
}

export async function handleGetServices(_req: Request, res: Response) {
  try {
    return res.status(200).json({ services: await getServices() });
  } catch (error) {
    console.error("Erro ao procurar serviços:", error);
    return res.status(500).json({ message: "Erro ao procurar serviços." });
  }
}
