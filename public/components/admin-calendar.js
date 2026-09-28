const START_MINUTES = 9 * 60;
const END_MINUTES = 19 * 60;
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

function initials(name) {
  return String(name)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function bookingCard(booking) {
  const start = timeToMinutes(booking.starts_at);
  const end = timeToMinutes(booking.ends_at);
  const left = Math.max(0, ((start - START_MINUTES) / TOTAL_MINUTES) * 100);
  const width = Math.max(4.8, ((end - start) / TOTAL_MINUTES) * 100);

  return `<button
    type="button"
    class="schedule-booking"
    data-open-booking="${escapeHtml(booking.id)}"
    data-booking-left="${left}"
    data-booking-width="${Math.min(width, 100 - left)}"
    title="${escapeHtml(`${getTime(booking.starts_at)} · ${booking.customer_name} · ${getServiceName(booking) || "Serviço"}`)}"
  >
    <strong>${escapeHtml(booking.customer_name)}</strong>
    <span>${escapeHtml(getTime(booking.starts_at))}–${escapeHtml(getTime(booking.ends_at))} · ${escapeHtml(getServiceName(booking) || "Serviço")}</span>
    <small>Confirmada</small>
  </button>`;
}

export function renderBookingCalendar(container, { barbers, bookings }) {
  if (!barbers.length) {
    container.innerHTML = '<p class="empty-state">Ainda não existem barbeiros na equipa.</p>';
    return;
  }

  const hours = Array.from({ length: 10 }, (_, index) => 9 + index);
  container.innerHTML = `
    <div class="schedule-canvas">
      <div class="schedule-header">
        <div class="schedule-team-label">BARBEIRO</div>
        <div class="schedule-hours">
          ${hours.map((hour) => `<span>${String(hour).padStart(2, "0")}:00</span>`).join("")}
        </div>
      </div>
      ${barbers.map((barber) => {
        const barberBookings = bookings.filter((booking) => booking.barber_id === barber.id);
        return `
          <div class="schedule-row">
            <div class="schedule-barber">
              <span class="schedule-avatar">${escapeHtml(initials(barber.name))}</span>
              <span><strong>${escapeHtml(barber.name)}</strong><small>${barberBookings.length} ${barberBookings.length === 1 ? "reserva" : "reservas"}</small></span>
            </div>
            <div class="schedule-timeline">
              <i class="schedule-lunch" aria-hidden="true"></i>
              ${barberBookings.map(bookingCard).join("")}
            </div>
          </div>`;
      }).join("")}
    </div>
  `;

  container.querySelectorAll("[data-booking-left]").forEach((element) => {
    element.style.left = `${Number(element.dataset.bookingLeft)}%`;
    element.style.width = `${Number(element.dataset.bookingWidth)}%`;
  });
}
