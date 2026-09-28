import nodemailer from "nodemailer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config/env";
import { getPublicPath } from "../config/paths";
import { BookingRequestBody } from "../types/data";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

type BookingConfirmationDetails = {
  barberName: string;
  serviceName: string;
};

function formatBookingDate(startsAt: string): { date: string; time: string } {
  const [rawDate, rawTime = ""] = startsAt.split("T");
  const date = new Date(`${rawDate}T12:00:00Z`);
  const formattedDate = new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);

  return {
    date: formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1),
    time: rawTime.slice(0, 5),
  };
}

function bookingConfirmationHtml(
  booking: BookingRequestBody,
  details: BookingConfirmationDetails,
  date: string,
  time: string,
  logoSource: string
): string {
  const customerName = escapeHtml(booking.customer_name);
  const serviceName = escapeHtml(details.serviceName);
  const barberName = escapeHtml(details.barberName);
  const bookingDate = escapeHtml(date);
  const bookingTime = escapeHtml(time);
  const contactEmail = escapeHtml(env.contactToEmail);

  return `<!doctype html>
<html lang="pt" style="background:#050505;">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="dark only">
    <meta name="supported-color-schemes" content="dark only">
    <title>Marcação confirmada</title>
    <style>
      :root { color-scheme: dark only; supported-color-schemes: dark only; }
      .outer-dark { background-color:#050505 !important; background-image:linear-gradient(#050505,#050505) !important; }
      .shell-dark { background-color:#12110f !important; background-image:linear-gradient(#12110f,#12110f) !important; }
      [data-ogsc] .outer-dark { background-color:#050505 !important; }
      [data-ogsc] .shell-dark { background-color:#12110f !important; }
      @media only screen and (max-width: 620px) {
        .email-shell { width: 100% !important; }
        .email-padding { padding-left: 24px !important; padding-right: 24px !important; }
        .detail-cell { display: block !important; width: 100% !important; box-sizing: border-box !important; }
        .detail-cell + .detail-cell { border-left: 0 !important; border-top: 1px solid #3f392f !important; }
        .title { font-size: 34px !important; line-height: 40px !important; }
      }
    </style>
  </head>
  <body class="outer-dark" bgcolor="#050505" style="margin:0;padding:0;background-color:#050505;background-image:linear-gradient(#050505,#050505);color:#cfc3b2;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">A tua marcação na ElDorado Barbershop está confirmada.</div>
    <table role="presentation" class="outer-dark" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#050505" style="width:100%;background-color:#050505;background-image:linear-gradient(#050505,#050505);">
      <tr>
        <td class="outer-dark" align="center" bgcolor="#050505" style="padding:36px 12px;background-color:#050505;background-image:linear-gradient(#050505,#050505);">
          <table role="presentation" class="email-shell shell-dark" width="600" cellspacing="0" cellpadding="0" border="0" bgcolor="#12110f" style="width:600px;max-width:600px;background-color:#12110f;background-image:linear-gradient(#12110f,#12110f);border:1px solid #393329;">
            <tr>
              <td align="center" bgcolor="#090909" style="padding:38px 24px 30px;background:#090909;border-bottom:1px solid #393329;">
                <img src="${escapeHtml(logoSource)}" width="104" alt="ElDorado Barbershop" style="display:block;width:104px;height:auto;border:0;outline:none;">
                <div style="margin-top:20px;color:#e9c176;font-size:10px;font-weight:700;letter-spacing:4px;text-transform:uppercase;">ElDorado Barbershop</div>
              </td>
            </tr>
            <tr>
              <td class="email-padding" bgcolor="#12110f" style="padding:42px 48px 18px;background:#12110f;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td bgcolor="#2b251b" style="padding:8px 13px;background:#2b251b;border:1px solid #55482f;color:#e9c176;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">✓ &nbsp; Marcação confirmada</td>
                  </tr>
                </table>
                <h1 class="title" style="margin:24px 0 14px;color:#d9cbb7;font-family:Georgia,'Times New Roman',serif;font-size:43px;font-weight:400;line-height:49px;letter-spacing:-1px;">Está tudo marcado.</h1>
                <p style="margin:0;color:#afa596;font-size:15px;line-height:25px;">Olá ${customerName}, a tua visita está confirmada. Reservámos este momento para ti.</p>
              </td>
            </tr>
            <tr>
              <td class="email-padding" bgcolor="#12110f" style="padding:20px 48px 10px;background:#12110f;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0a0a09" style="width:100%;background:#0a0a09;border:1px solid #3f392f;">
                  <tr>
                    <td colspan="2" style="padding:20px 22px;border-bottom:1px solid #3f392f;color:#e9c176;font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;">Detalhes da visita</td>
                  </tr>
                  <tr>
                    <td class="detail-cell" width="50%" valign="top" bgcolor="#0a0a09" style="width:50%;padding:22px;background:#0a0a09;border-right:1px solid #3f392f;">
                      <div style="color:#8f887e;font-size:9px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">Serviço</div>
                      <div style="margin-top:8px;color:#d9cbb7;font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:25px;">${serviceName}</div>
                    </td>
                    <td class="detail-cell" width="50%" valign="top" bgcolor="#0a0a09" style="width:50%;padding:22px;background:#0a0a09;">
                      <div style="color:#8f887e;font-size:9px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">Barbeiro</div>
                      <div style="margin-top:8px;color:#d9cbb7;font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:25px;">${barberName}</div>
                    </td>
                  </tr>
                  <tr>
                    <td class="detail-cell" width="50%" valign="top" bgcolor="#0a0a09" style="width:50%;padding:22px;background:#0a0a09;border-top:1px solid #3f392f;border-right:1px solid #3f392f;">
                      <div style="color:#8f887e;font-size:9px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">Data</div>
                      <div style="margin-top:8px;color:#cfc3b2;font-size:14px;font-weight:600;line-height:22px;">${bookingDate}</div>
                    </td>
                    <td class="detail-cell" width="50%" valign="top" bgcolor="#0a0a09" style="width:50%;padding:22px;background:#0a0a09;border-top:1px solid #3f392f;">
                      <div style="color:#8f887e;font-size:9px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">Hora</div>
                      <div style="margin-top:6px;color:#e9c176;font-family:Georgia,'Times New Roman',serif;font-size:27px;line-height:31px;">${bookingTime}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-padding" bgcolor="#12110f" style="padding:24px 48px 44px;background:#12110f;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;">
                  <tr>
                    <td bgcolor="#1b1814" style="padding:20px 22px;background:#1b1814;border-left:3px solid #e9c176;color:#aaa092;font-size:13px;line-height:21px;">Precisas de alterar ou cancelar? Basta responder a este email e tratamos de tudo contigo.</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" bgcolor="#090909" style="padding:26px 24px;background:#090909;border-top:1px solid #393329;color:#776f65;font-size:11px;line-height:19px;">
                <div style="color:#b9aa96;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Precisão. Estilo. Confiança.</div>
                <div style="margin-top:10px;">ElDorado Barbershop &nbsp;·&nbsp; <a href="mailto:${contactEmail}" style="color:#bca16b;text-decoration:none;">${contactEmail}</a></div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function encodeMimeHeader(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function encodeMimeBody(value: string): string {
  return Buffer.from(value, "utf8").toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? "";
}

function createRawEmail(to: string, subject: string, text: string, html: string): string {
  const boundary = `eldorado-${randomUUID()}`;
  const message = [
    `From: ElDorado Barbershop <${env.gmailUser}>`,
    `To: ${to}`,
    `Reply-To: ${env.contactToEmail}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    encodeMimeBody(text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    encodeMimeBody(html),
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return Buffer.from(message, "utf8").toString("base64url");
}

async function sendWithGmailApi(to: string, subject: string, text: string, html: string): Promise<void> {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.gmailApiClientId,
      client_secret: env.gmailApiClientSecret,
      refresh_token: env.gmailApiRefreshToken,
      grant_type: "refresh_token",
    }),
  });
  const tokenResult = await tokenResponse.json() as { access_token?: string; error?: string; error_description?: string };
  if (!tokenResponse.ok || !tokenResult.access_token) {
    throw new Error(`Não foi possível autenticar na Gmail API: ${tokenResult.error_description ?? tokenResult.error ?? tokenResponse.status}.`);
  }

  const sendResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenResult.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: createRawEmail(to, subject, text, html) }),
  });
  if (!sendResponse.ok) {
    const result = await sendResponse.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(`A Gmail API recusou o email: ${result.error?.message ?? sendResponse.status}.`);
  }
}

export async function sendBookingConfirmation(
  booking: BookingRequestBody,
  details: BookingConfirmationDetails
): Promise<void> {
  if (!env.emailConfigured) return;

  const { date, time } = formatBookingDate(booking.starts_at);
  const subject = "Confirmação da tua marcação — ElDorado Barbershop";
  const text = [
    `Olá ${booking.customer_name},`,
    "",
    "A tua marcação na ElDorado Barbershop está confirmada.",
    "",
    `Serviço: ${details.serviceName}`,
    `Barbeiro: ${details.barberName}`,
    `Data: ${date}`,
    `Hora: ${time}`,
    "",
    "Se precisares de alterar ou cancelar a marcação, responde a este email.",
    "",
    "Até breve,",
    "ElDorado Barbershop",
  ].join("\n");
  const remoteLogo = new URL("/img/logo-email.png", `${env.appOrigin}/`).href;
  const html = bookingConfirmationHtml(booking, details, date, time, remoteLogo);

  if (env.gmailApiConfigured) {
    await sendWithGmailApi(
      booking.customer_email,
      subject,
      text,
      html
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: env.gmailUser, pass: env.gmailAppPassword },
  });

  await transporter.sendMail({
    from: `ElDorado Barbershop <${env.gmailUser}>`,
    to: booking.customer_email,
    replyTo: env.contactToEmail,
    subject,
    text,
    html: bookingConfirmationHtml(booking, details, date, time, "cid:eldorado-logo"),
    attachments: [{
      filename: "eldorado-logo.png",
      path: path.join(getPublicPath(), "img", "logo-email.png"),
      cid: "eldorado-logo",
      contentType: "image/png",
      contentDisposition: "inline",
    }],
  });
}
