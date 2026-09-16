const START_HOUR = 9;
const END_HOUR = 19;
const MINUTE_HEIGHT = 1.25;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTime(value) {
  const time = String(value).split("T")[1]?.slice(0, 5) ?? "00:00";
  const [hours, minutes] = time.split(":").map(Number);
  return { time, minutes: hours * 60 + minutes };
}

function getServiceName(booking) {
  return Array.isArray(booking.services) ? booking.services[0]?.name : booking.services?.name;
}

function eventCard(booking) {
  const start = getTime(booking.starts_at);
  const end = getTime(booking.ends_at);
  const calendarStart = START_HOUR * 60;
  const top = Math.max(0, (start.minutes - calendarStart) * MINUTE_HEIGHT);
  const height = Math.max(36, (end.minutes - start.minutes) * MINUTE_HEIGHT);

  return `<button
    type="button"
    data-open-booking="${escapeHtml(booking.id)}"
    class="calendar-booking absolute inset-x-1 overflow-hidden rounded-sm border border-[#f4d497]/70 bg-gold/85 px-2 py-1.5 text-left text-ink shadow-[0_8px_24px_rgba(197,160,89,0.24)]"
    style="top:${top}px;height:${height}px"
    title="${escapeHtml(`${start.time} · ${booking.customer_name} · ${getServiceName(booking) || "Serviço"}`)}"
  >
    <strong class="block truncate text-[9px] font-bold leading-3">${escapeHtml(booking.customer_name)}</strong>
    <span class="block truncate text-[7px] font-semibold leading-3">${escapeHtml(start.time)} · ${escapeHtml(getServiceName(booking) || "Serviço")}</span>
  </button>`;
}

export function renderBookingCalendar(container, { weekStart, bookings, canGoPrevious }) {
  const days = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
  const today = toIsoDate(new Date());
  const dayFormatter = new Intl.DateTimeFormat("pt-PT", { weekday: "short" });
  const monthFormatter = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" });
  const rangeFormatter = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "long" });
  const lastDay = days[5];
  const totalHeight = (END_HOUR - START_HOUR) * 60 * MINUTE_HEIGHT;
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => START_HOUR + index);

  const bookingsByDay = Object.groupBy
    ? Object.groupBy(bookings, (booking) => String(booking.starts_at).slice(0, 10))
    : bookings.reduce((result, booking) => {
        const key = String(booking.starts_at).slice(0, 10);
        (result[key] ||= []).push(booking);
        return result;
      }, {});

  container.innerHTML = `
    <div class="calendar-toolbar mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-[8px] font-semibold tracking-[0.18em] text-gold">SEMANA VISÍVEL</p>
        <h3 class="mt-1 font-display text-xl">${escapeHtml(rangeFormatter.format(weekStart))} — ${escapeHtml(rangeFormatter.format(lastDay))}</h3>
      </div>
      <div class="flex items-center border border-line bg-ink">
        <button type="button" data-calendar-action="previous" ${canGoPrevious ? "" : "disabled"} aria-label="Semana anterior" class="flex h-10 w-10 items-center justify-center text-muted hover:text-gold disabled:cursor-not-allowed disabled:opacity-25"><span class="material-symbols-outlined">chevron_left</span></button>
        <button type="button" data-calendar-action="today" class="border-x border-line px-4 py-3 text-[8px] font-bold tracking-[0.12em] text-muted hover:text-gold">ESTA SEMANA</button>
        <button type="button" data-calendar-action="next" aria-label="Semana seguinte" class="flex h-10 w-10 items-center justify-center text-muted hover:text-gold"><span class="material-symbols-outlined">chevron_right</span></button>
      </div>
    </div>
    <div class="calendar-scroll overflow-x-auto border border-line bg-ink">
      <div class="calendar-canvas min-w-[880px]">
        <div class="calendar-week-grid sticky top-0 z-20 border-b border-line bg-[#171616]">
          <div class="border-r border-line"></div>
          ${days.map((date) => {
            const iso = toIsoDate(date);
            return `<div class="border-r border-line px-2 py-3 text-center last:border-r-0 ${iso === today ? "bg-gold/10" : ""}"><span class="block text-[8px] font-bold uppercase tracking-[0.12em] text-muted">${escapeHtml(dayFormatter.format(date).replace(".", ""))}</span><strong class="mt-1 block font-display text-lg ${iso === today ? "text-gold" : ""}">${escapeHtml(monthFormatter.format(date).replace(".", ""))}</strong></div>`;
          }).join("")}
        </div>
        <div class="calendar-week-grid relative" style="height:${totalHeight}px">
          <div class="relative border-r border-line bg-[#111]">
            ${hours.map((hour, index) => `<span class="absolute right-3 -translate-y-1/2 text-[8px] text-muted" style="top:${index * 60 * MINUTE_HEIGHT}px">${String(hour).padStart(2, "0")}:00</span>`).join("")}
          </div>
          ${days.map((date) => {
            const iso = toIsoDate(date);
            const dayBookings = bookingsByDay[iso] ?? [];
            return `<div class="calendar-day relative border-r border-line last:border-r-0 ${iso === today ? "bg-gold/[0.025]" : ""}" data-calendar-day="${iso}">${dayBookings.map(eventCard).join("")}</div>`;
          }).join("")}
        </div>
      </div>
    </div>
    ${bookings.length ? "" : '<p class="mt-4 text-center text-[9px] text-muted">Não existem reservas nesta semana.</p>'}
  `;
}
