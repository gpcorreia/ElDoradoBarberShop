import nodemailer from "nodemailer";
import { env } from "../config/env";
import { BookingRequestBody } from "../types/data";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendBookingNotification(booking: BookingRequestBody): Promise<void> {
  if (!env.emailConfigured) return;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: env.gmailUser, pass: env.gmailAppPassword },
  });

  const startsAt = booking.starts_at.replace("T", " ").slice(0, 16);
  const text = [
    "Nova marcação recebida no website.",
    "",
    `Cliente: ${booking.customer_name}`,
    `Email: ${booking.customer_email}`,
    `Telefone: ${booking.customer_phone}`,
    `Data e hora: ${startsAt}`,
    `Barbeiro: ${booking.barber_id}`,
    `Serviço: ${booking.service_id}`,
  ].join("\n");

  await transporter.sendMail({
    from: `ElDorado Barbershop <${env.gmailUser}>`,
    to: env.contactToEmail,
    replyTo: booking.customer_email,
    subject: `Nova marcação — ${booking.customer_name}`,
    text,
    html: `<h1>Nova marcação</h1><p><strong>Cliente:</strong> ${escapeHtml(booking.customer_name)}</p><p><strong>Email:</strong> ${escapeHtml(booking.customer_email)}</p><p><strong>Telefone:</strong> ${escapeHtml(booking.customer_phone)}</p><p><strong>Data e hora:</strong> ${escapeHtml(startsAt)}</p><p><strong>Barbeiro:</strong> ${escapeHtml(booking.barber_id)}</p><p><strong>Serviço:</strong> ${escapeHtml(booking.service_id)}</p>`,
  });
}
