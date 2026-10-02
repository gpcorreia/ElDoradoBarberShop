const START_MINUTES = 8 * 60;
const END_MINUTES = 22 * 60;
const TOTAL_MINUTES = END_MINUTES - START_MINUTES;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getTime(value) {
  return String(value).split("T")[1]?.slice(0, 5) ?? "00:00";
}

function timeToMinutes(value) {
  const [hours, minutes] = getTime(value).split(":").map(Number);
  return hours * 60 + minutes;
}

function getServiceName(booking) {
  return Array.isArray(booking.services) ? booking.services[0]?.name : booking.services?.name;
}

function getInitials(name) {
  return String(name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function barberAvatar(barber) {
  if (barber.photo_url) {
    return `<img src="${escapeHtml(barber.photo_url)}" alt="" loading="lazy" />`;
  }

  return `<span aria-hidden="true">${escapeHtml(getInitials(barber.name))}</span>`;
}

function bookingCard(booking, tone) {
  const start = timeToMinutes(booking.starts_at);
  const end = timeToMinutes(booking.ends_at);
  const top = Math.max(0, ((start - START_MINUTES) / TOTAL_MINUTES) * 100);
  const height = Math.max(0, ((end - start) / TOTAL_MINUTES) * 100);
  const service = getServiceName(booking) || "Serviço";
  const timeRange = `${getTime(booking.starts_at)}–${getTime(booking.ends_at)}`;
  const label = `${timeRange}, ${service}, ${booking.customer_name}`;

  return `<button
    type="button"
    class="schedule-booking schedule-booking--tone-${tone}"
    data-open-booking="${escapeHtml(booking.id)}"
    data-booking-top="${top}"
    data-booking-height="${Math.min(height, 100 - top)}"
    aria-label="${escapeHtml(label)}"
    title="${escapeHtml(label)}"
  >
    <strong>${escapeHtml(service)}</strong>
    <span>${escapeHtml(booking.customer_name)}</span>
    <small>${escapeHtml(timeRange)}</small>
  </button>`;
}

function isToday(day) {
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return String(day ?? "").slice(0, 10) === localToday;
}

export function renderBookingCalendar(container, { barbers, bookings, day }) {
  if (!barbers.length) {
    container.innerHTML = '<p class="empty-state">Ainda não existem barbeiros na equipa.</p>';
    return;
  }

  const hourMarkers = Array.from({ length: (TOTAL_MINUTES / 60) + 1 }, (_, index) => {
    const minutes = START_MINUTES + (index * 60);
    return {
      label: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:00`,
      position: (index / (TOTAL_MINUTES / 60)) * 100,
      edge: index === 0 ? "is-start" : index === TOTAL_MINUTES / 60 ? "is-end" : "",
    };
  });

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showNow = isToday(day) && nowMinutes >= START_MINUTES && nowMinutes <= END_MINUTES;
  const nowPosition = ((nowMinutes - START_MINUTES) / TOTAL_MINUTES) * 100;

  container.innerHTML = `
    <div class="schedule-canvas" data-barber-count="${barbers.length}">
      <div class="schedule-header">
        <div class="schedule-time-corner"><span class="material-symbols-outlined">schedule</span><span>HORA</span></div>
        ${barbers.map((barber) => {
          const count = bookings.filter((booking) => booking.barber_id === barber.id).length;
          return `<div class="schedule-barber-heading">
            <span class="schedule-barber-avatar">${barberAvatar(barber)}</span>
            <span class="schedule-barber-copy"><strong>${escapeHtml(barber.name)}</strong><small>${count} ${count === 1 ? "reserva" : "reservas"}</small></span>
          </div>`;
        }).join("")}
      </div>
      <div class="schedule-body">
        <div class="schedule-time-axis" aria-hidden="true">
          ${hourMarkers.map((marker) => `<span class="${marker.edge}" data-time-position="${marker.position}">${marker.label}</span>`).join("")}
        </div>
        ${barbers.map((barber, index) => {
          const barberBookings = bookings.filter((booking) => booking.barber_id === barber.id);
          return `<div class="schedule-column" role="group" aria-label="Agenda de ${escapeHtml(barber.name)}">
            ${barberBookings.map((booking) => bookingCard(booking, index % 4)).join("")}
          </div>`;
        }).join("")}
        ${showNow ? `<i class="schedule-now-line" data-time-position="${nowPosition}" aria-label="Hora atual: ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}"><span></span></i>` : ""}
      </div>
    </div>
  `;

  const canvas = container.querySelector(".schedule-canvas");
  canvas.style.setProperty("--barber-count", String(barbers.length));

  container.querySelectorAll("[data-time-position]").forEach((element) => {
    element.style.top = `${Number(element.dataset.timePosition)}%`;
  });

  container.querySelectorAll("[data-booking-top]").forEach((element) => {
    element.style.top = `${Number(element.dataset.bookingTop)}%`;
    element.style.height = `${Number(element.dataset.bookingHeight)}%`;
  });
}
