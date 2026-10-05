import { renderBookingCalendar, scheduleTimeFromPoint } from "/components/admin-calendar.js";

const tabs = [...document.querySelectorAll("[data-tab]")];
const panels = [...document.querySelectorAll("[data-panel]")];
const barberSelect = document.querySelector("#booking-barber");
const bookingsList = document.querySelector("#bookings-list");
const agendaDate = document.querySelector("#agenda-date");
const bookingDialog = document.querySelector("#booking-detail-dialog");
const bookingDetail = document.querySelector("#booking-detail");
const manualBookingDialog = document.querySelector("#manual-booking-dialog");
const manualBookingForm = document.querySelector("#manual-booking-form");
const reservationsList = document.querySelector("#reservations-list");
const reservationSearch = document.querySelector("#reservation-search");
const reservationBarber = document.querySelector("#reservation-barber");
const reservationDate = document.querySelector("#reservation-date");
const adminProductsList = document.querySelector("#admin-products-list");
const messageBox = document.querySelector("#admin-message");
let messageTimer;
let barbers = [];
let services = [];
let currentBookings = [];
let reservations = [];
let preferredManualTime = "";
let visibleDay = new Date();
visibleDay.setHours(0, 0, 0, 0);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function relation(value) {
  return Array.isArray(value) ? value[0] : value;
}

function getServiceName(booking) {
  return relation(booking.services)?.name;
}

function getBarberName(booking) {
  return relation(booking.barbers)?.name;
}

function formatPrice(value) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function formatShortPrice(value) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toLocalTimestamp(date) {
  return `${toIsoDate(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function localDateFromIso(value) {
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatBookingDate(value) {
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

function showMessage(title, text, error = false) {
  clearTimeout(messageTimer);
  document.querySelector("#admin-message-title").textContent = title;
  document.querySelector("#admin-message-text").textContent = text;
  document.querySelector("#admin-message-icon").textContent = error ? "error" : "check_circle";
  messageBox.classList.toggle("is-error", error);
  messageBox.classList.add("is-visible");
  messageTimer = setTimeout(() => messageBox.classList.remove("is-visible"), 4500);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: "application/json", ...options.headers },
  });
  const result = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.location.replace("/admin/login");
    throw new Error("Sessão expirada.");
  }
  if (!response.ok) throw new Error(result.message || `Pedido falhou (${response.status}).`);
  return result;
}

function activateTab(name) {
  tabs.forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-current", active ? "page" : "false");
  });
  panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== name; });
  if (name === "bookings" && barbers.length) loadBookings();
  if (name === "reservations" && barbers.length) loadReservations();
  if (name === "invoicing") loadInvoicing();
}

function setProgress(element, percentage) {
  element.style.width = `${Math.max(0, Math.min(100, Number(percentage) || 0))}%`;
}

async function loadBarbers() {
  const result = await api("/api/barbers");
  barbers = result.barbers ?? [];
  barberSelect.innerHTML = '<option value="">Todos os barbeiros</option>' + barbers
    .map((barber) => `<option value="${escapeHtml(barber.id)}">${escapeHtml(barber.name)}</option>`)
    .join("");
  reservationBarber.innerHTML = '<option value="">Todos</option>' + barbers
    .map((barber) => `<option value="${escapeHtml(barber.id)}">${escapeHtml(barber.name)}</option>`)
    .join("");
  manualBookingForm.elements.barber_id.innerHTML = '<option value="">Seleciona</option>' + barbers
    .map((barber) => `<option value="${escapeHtml(barber.id)}">${escapeHtml(barber.name)}</option>`)
    .join("");
  document.querySelector("#schedule-team-count").textContent = `${barbers.length} ${barbers.length === 1 ? "barbeiro" : "barbeiros"}`;
  return barbers;
}

async function loadServices() {
  const result = await api("/api/services");
  services = result.services ?? [];
  manualBookingForm.elements.service_id.innerHTML = '<option value="">Seleciona</option>' + services
    .map((service) => `<option value="${escapeHtml(service.id)}">${escapeHtml(service.name)} · ${escapeHtml(formatPrice(service.price))}</option>`)
    .join("");
}

function renderRanking(containerSelector, items, kind) {
  const container = document.querySelector(containerSelector);
  if (!items.length) {
    container.innerHTML = `<p class="empty-state">Ainda não existem ${kind === "service" ? "serviços reservados" : "dados da equipa"} neste mês.</p>`;
    return;
  }
  const max = Math.max(1, ...items.map((item) => item.bookings));
  container.innerHTML = items.slice(0, 5).map((item) => `
    <div class="ranking-item">
      <div><div class="ranking-copy"><span>${escapeHtml(item.name)}</span><small>${item.bookings} ${item.bookings === 1 ? "reserva" : "reservas"}</small></div></div>
      <strong>${escapeHtml(formatShortPrice(item.revenue))}</strong>
      <div class="ranking-track"><i data-ranking-width="${(item.bookings / max) * 100}"></i></div>
    </div>`).join("");
  container.querySelectorAll("[data-ranking-width]").forEach((bar) => setProgress(bar, bar.dataset.rankingWidth));
}

function renderOperationalRanking(containerSelector, items, kind) {
  const container = document.querySelector(containerSelector);
  if (!items.length) {
    container.innerHTML = `<p class="empty-state">Sem ${kind === "service" ? "serviços" : "atividade da equipa"} para hoje.</p>`;
    return;
  }
  const max = Math.max(1, ...items.map((item) => item.bookings));
  container.innerHTML = items.slice(0, 6).map((item) => {
    const detail = kind === "service"
      ? `${item.bookings} ${item.bookings === 1 ? "reserva" : "reservas"}`
      : `${item.bookings} reservas · ${item.bookedMinutes} min`;
    return `<div class="ranking-item"><div><div class="ranking-copy"><span>${escapeHtml(item.name)}</span><small>${escapeHtml(detail)}</small></div></div><strong>${item.bookings}</strong><div class="ranking-track"><i data-ranking-width="${(item.bookings / max) * 100}"></i></div></div>`;
  }).join("");
  container.querySelectorAll("[data-ranking-width]").forEach((bar) => setProgress(bar, bar.dataset.rankingWidth));
}

function renderTodayAgenda(items) {
  const container = document.querySelector("#today-upcoming");
  if (!items.length) {
    container.innerHTML = '<p class="empty-state">Não existem marcações ativas para hoje.</p>';
    return;
  }
  container.innerHTML = items.map((item) => {
    const time = String(item.starts_at).slice(11, 16);
    return `<div class="upcoming-item"><span class="upcoming-time"><strong>${escapeHtml(time)}</strong><small>hoje</small></span><span class="upcoming-copy"><strong>${escapeHtml(item.customer_name)}</strong><span>${escapeHtml(item.service_name)} · ${escapeHtml(item.barber_name)}</span></span><small>RESERVA</small></div>`;
  }).join("");
}

function renderInvoicingChart(monthly) {
  const container = document.querySelector("#invoicing-chart");
  if (!monthly.length) {
    container.innerHTML = '<p class="empty-state">Ainda não existem dados de faturação.</p>';
    return;
  }
  const width = 760;
  const height = 250;
  const padding = 28;
  const maximum = Math.max(1, ...monthly.map((item) => Number(item.revenue)));
  const points = monthly.map((item, index) => ({
    ...item,
    x: padding + (index / Math.max(1, monthly.length - 1)) * (width - padding * 2),
    y: height - padding - (Number(item.revenue) / maximum) * (height - padding * 2),
  }));
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const area = `${path} L${points.at(-1).x},${height - padding} L${points[0].x},${height - padding} Z`;
  const labels = monthly.map((item) => {
    const date = new Date(`${item.month}-01T12:00:00Z`);
    return new Intl.DateTimeFormat("pt-PT", { month: "short" }).format(date).replace(".", "");
  });
  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolução da faturação nos últimos 12 meses"><defs><linearGradient id="invoice-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9c176" stop-opacity=".28"/><stop offset="1" stop-color="#e9c176" stop-opacity="0"/></linearGradient></defs><path class="invoice-grid-line" d="M${padding},${height-padding} H${width-padding} M${padding},${height/2} H${width-padding} M${padding},${padding} H${width-padding}"/><path class="invoice-area" d="${area}"/><path class="invoice-line" d="${path}"/>${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4"><title>${escapeHtml(point.month)}: ${escapeHtml(formatPrice(point.revenue))}</title></circle>`).join("")}</svg><div class="invoicing-chart-labels">${labels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</div>`;
}

async function loadDashboard() {
  try {
    const { overview } = await api("/api/admin/dashboard");
    const { summary } = overview;
    const todayName = new Intl.DateTimeFormat("pt-PT", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
    document.querySelector("#dashboard-period").textContent = todayName[0].toUpperCase() + todayName.slice(1);
    document.querySelector("#metric-today-bookings").textContent = summary.todayBookings;
    document.querySelector("#metric-today-note").textContent = summary.todayBookings ? "Marcações ativas para o dia" : "Agenda livre para hoje";
    document.querySelector("#metric-occupancy").textContent = summary.occupancyToday;
    setProgress(document.querySelector("#metric-occupancy-bar"), summary.occupancyToday);
    document.querySelector("#metric-cancellations").textContent = summary.cancellationsToday;
    document.querySelector("#metric-cancellations-note").textContent = summary.cancellationsToday ? "Cancelamentos registados hoje" : "Sem cancelamentos hoje";
    document.querySelector("#metric-no-shows").textContent = summary.noShowsToday;
    document.querySelector("#today-bookings-badge").textContent = `${summary.todayBookings} reservas`;
    renderTodayAgenda(overview.upcoming);
    renderOperationalRanking("#service-ranking", overview.services, "service");
    renderOperationalRanking("#barber-ranking", overview.barbers, "barber");
  } catch (error) {
    document.querySelector("#today-upcoming").innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
    showMessage("Dashboard indisponível", error.message, true);
  }
}

async function loadInvoicing() {
  const chart = document.querySelector("#invoicing-chart");
  chart.innerHTML = '<p class="empty-state">A carregar faturação…</p>';
  try {
    const { invoicing } = await api("/api/admin/invoicing");
    const { summary } = invoicing;
    const monthName = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(new Date());
    document.querySelector("#invoicing-period").textContent = monthName[0].toUpperCase() + monthName.slice(1);
    document.querySelector("#invoice-month-revenue").textContent = formatShortPrice(summary.monthRevenue);
    document.querySelector("#invoice-month-note").textContent = `${summary.monthBookings} ${summary.monthBookings === 1 ? "reserva ativa" : "reservas ativas"} no mês`;
    document.querySelector("#invoice-average-ticket").textContent = formatPrice(summary.averageTicket);
    document.querySelector("#invoice-previous-revenue").textContent = formatShortPrice(summary.previousRevenue);
    const change = summary.percentageChange;
    document.querySelector("#invoice-change").textContent = change === null ? "—" : `${change >= 0 ? "+" : ""}${change}`;
    document.querySelector("#invoice-change-note").textContent = change === null ? "Ainda sem histórico comparável" : `${change >= 0 ? "Crescimento" : "Descida"} face ao mês anterior`;
    renderInvoicingChart(invoicing.monthly);
    renderRanking("#invoice-service-ranking", invoicing.services, "service");
    renderRanking("#invoice-barber-ranking", invoicing.barbers, "barber");
  } catch (error) {
    chart.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
    showMessage("Faturação indisponível", error.message, true);
  }
}

function renderReservations() {
  const search = reservationSearch.value.trim().toLocaleLowerCase("pt-PT");
  const barberId = reservationBarber.value;
  const day = reservationDate.value;
  const filtered = reservations.filter((booking) => {
    const searchable = [booking.customer_name, booking.customer_email, booking.customer_phone, getServiceName(booking), getBarberName(booking)]
      .join(" ")
      .toLocaleLowerCase("pt-PT");
    return (!search || searchable.includes(search))
      && (!barberId || booking.barber_id === barberId)
      && (!day || String(booking.starts_at).startsWith(day));
  });

  document.querySelector("#reservations-count").textContent = `${filtered.length} ${filtered.length === 1 ? "reserva" : "reservas"}`;
  if (!filtered.length) {
    reservationsList.innerHTML = '<p class="empty-state reservations-empty">Não existem reservas para os filtros selecionados.</p>';
    return;
  }

  const dayFormatter = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" });
  const weekdayFormatter = new Intl.DateTimeFormat("pt-PT", { weekday: "short" });
  const timeFormatter = new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit" });
  reservationsList.innerHTML = filtered.map((booking) => {
    const date = new Date(booking.starts_at);
    return `<article class="reservation-row">
      <div class="reservation-day"><strong>${escapeHtml(dayFormatter.format(date).replace(".", ""))}</strong><span>${escapeHtml(weekdayFormatter.format(date).replace(".", ""))}</span></div>
      <div class="reservation-client"><strong>${escapeHtml(booking.customer_name)}</strong><span>${escapeHtml(getServiceName(booking) || "Serviço")} · ${escapeHtml(getBarberName(booking) || "Barbeiro")}</span></div>
      <div class="reservation-contact"><span class="material-symbols-outlined">call</span><span>${escapeHtml(booking.customer_phone || "Sem telefone")}</span></div>
      <div class="reservation-time"><strong>${escapeHtml(timeFormatter.format(date))}</strong><span>Confirmada</span></div>
      <div class="reservation-actions"><button type="button" data-view-reservation="${escapeHtml(booking.id)}" class="reservation-action">DETALHES</button><button type="button" data-cancel-reservation="${escapeHtml(booking.id)}" class="reservation-action reservation-action-danger">CANCELAR</button></div>
    </article>`;
  }).join("");
}

async function loadReservations() {
  reservationsList.innerHTML = '<p class="empty-state reservations-empty">A carregar reservas…</p>';
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 61);
  try {
    const query = new URLSearchParams({ start: toLocalTimestamp(start), end: toLocalTimestamp(end) });
    const result = await api(`/api/admin/bookings?${query}`);
    reservations = result.bookings ?? [];
    renderReservations();
  } catch (error) {
    reservationsList.innerHTML = `<p class="empty-state reservations-empty">${escapeHtml(error.message)}</p>`;
  }
}

function updateAgendaHeading() {
  agendaDate.value = toIsoDate(visibleDay);
  document.querySelector("#agenda-readable-date").textContent = new Intl.DateTimeFormat("pt-PT", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  }).format(visibleDay);
}

async function loadBookings() {
  updateAgendaHeading();
  const selectedId = barberSelect.value;
  const visibleBarbers = selectedId ? barbers.filter((barber) => barber.id === selectedId) : barbers;
  if (!visibleBarbers.length) {
    currentBookings = [];
    renderBookingCalendar(bookingsList, { barbers: [], bookings: [] });
    return;
  }

  bookingsList.innerHTML = '<p class="empty-state">A carregar a agenda da equipa…</p>';
  const start = new Date(visibleDay);
  const end = new Date(visibleDay);
  end.setDate(end.getDate() + 1);
  const query = new URLSearchParams({ start: toLocalTimestamp(start), end: toLocalTimestamp(end) });
  try {
    const results = await Promise.all(visibleBarbers.map((barber) =>
      api(`/api/admin/barbers/${encodeURIComponent(barber.id)}/bookings?${query}`)
    ));
    currentBookings = results.flatMap((result) => result.bookings ?? []);
    renderBookingCalendar(bookingsList, { barbers: visibleBarbers, bookings: currentBookings, day: toIsoDate(visibleDay) });
  } catch (error) {
    bookingsList.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
  }
}

function openBookingDetails(booking) {
  const canCancel = booking.status === "confirmed" && String(booking.starts_at) > toLocalTimestamp(new Date());
  bookingDetail.innerHTML = `
    <article class="booking-dialog-content">
      <button type="button" data-close-booking class="icon-button booking-dialog-close" aria-label="Fechar"><span class="material-symbols-outlined">close</span></button>
      <p class="eyebrow">DETALHES DA RESERVA</p>
      <h3>${escapeHtml(booking.customer_name)}</h3>
      <dl class="booking-details">
        <div><dt>Serviço</dt><dd>${escapeHtml(getServiceName(booking) || "Serviço")}</dd></div>
        <div><dt>Barbeiro</dt><dd>${escapeHtml(getBarberName(booking) || barbers.find((item) => item.id === booking.barber_id)?.name || "—")}</dd></div>
        <div><dt>Data e hora</dt><dd>${escapeHtml(formatBookingDate(booking.starts_at))}</dd></div>
        <div><dt>Telefone</dt><dd>${escapeHtml(booking.customer_phone || "—")}</dd></div>
        <div><dt>Email</dt><dd>${escapeHtml(booking.customer_email || "—")}</dd></div>
      </dl>
      ${canCancel ? `<button type="button" data-cancel-booking="${escapeHtml(booking.id)}" class="danger-button booking-cancel">CANCELAR RESERVA</button>` : ""}
    </article>`;
  bookingDialog.showModal();
}

async function loadManualAvailability() {
  const barberId = manualBookingForm.elements.barber_id.value;
  const serviceId = manualBookingForm.elements.service_id.value;
  const day = manualBookingForm.elements.day.value;
  const timeSelect = manualBookingForm.elements.time;

  timeSelect.disabled = true;
  if (!barberId || !serviceId || !day) {
    timeSelect.innerHTML = '<option value="">Escolhe os dados acima</option>';
    return;
  }
  if (localDateFromIso(day).getDay() === 0) {
    timeSelect.innerHTML = '<option value="">Encerrado ao domingo</option>';
    return;
  }

  timeSelect.innerHTML = '<option value="">A carregar horários…</option>';
  try {
    const query = new URLSearchParams({ service_id: serviceId });
    const result = await api(`/api/admin/appointments/${encodeURIComponent(barberId)}/${encodeURIComponent(day)}?${query}`);
    if (!result.appointments?.length) {
      timeSelect.innerHTML = '<option value="">Sem horários disponíveis</option>';
      return;
    }
    timeSelect.innerHTML = '<option value="">Seleciona</option>' + result.appointments
      .map((time) => `<option value="${escapeHtml(time)}">${escapeHtml(time)}</option>`)
      .join("");
    timeSelect.disabled = false;
    if (preferredManualTime && result.appointments.includes(preferredManualTime)) {
      timeSelect.value = preferredManualTime;
    } else if (preferredManualTime) {
      showMessage("Horário indisponível", "O serviço escolhido não cabe nesse espaço. Seleciona outro horário.", true);
    }
  } catch (error) {
    timeSelect.innerHTML = '<option value="">Não foi possível carregar</option>';
    showMessage("Horários indisponíveis", error.message, true);
  }
}

function openManualBooking(prefill = {}) {
  manualBookingForm.reset();
  preferredManualTime = prefill.time || "";
  const requestedDay = prefill.day ? localDateFromIso(prefill.day) : visibleDay;
  manualBookingForm.elements.day.removeAttribute("min");
  manualBookingForm.elements.day.value = toIsoDate(requestedDay);
  const activeTab = document.querySelector("[data-tab].is-active")?.dataset.tab;
  manualBookingForm.elements.barber_id.value = prefill.barberId || (activeTab === "reservations" ? reservationBarber.value : barberSelect.value);
  manualBookingForm.elements.time.innerHTML = `<option value="">${preferredManualTime ? `Escolhe o serviço para reservar às ${escapeHtml(preferredManualTime)}` : "Escolhe barbeiro e serviço"}</option>`;
  manualBookingForm.elements.time.disabled = true;
  manualBookingDialog.showModal();
}

async function cancelReservation(bookingId, button) {
  if (!confirm("Tens a certeza de que queres cancelar esta reserva? O horário ficará novamente disponível.")) return;
  if (button) button.disabled = true;
  try {
    const result = await api(`/api/admin/bookings/${encodeURIComponent(bookingId)}/cancel`, { method: "PATCH" });
    bookingDialog.close();
    showMessage("Reserva cancelada", result.message);
    await Promise.all([loadBookings(), loadReservations(), loadDashboard()]);
  } catch (error) {
    showMessage("Não foi possível cancelar", error.message, true);
    if (button) button.disabled = false;
  }
}

async function loadAdminProducts() {
  adminProductsList.innerHTML = '<p class="empty-state">A carregar produtos…</p>';
  try {
    const { products } = await api("/api/products");
    if (!products.length) {
      adminProductsList.innerHTML = '<p class="empty-state">Não existem produtos publicados.</p>';
      return;
    }
    adminProductsList.innerHTML = products.map((product) => `
      <article class="product-row">
        <img src="${escapeHtml(product.image_url)}" alt="" />
        <div class="product-copy"><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category)} · ${escapeHtml(formatPrice(product.price))}</small></div>
        <button type="button" data-remove-product="${escapeHtml(product.id)}" data-product-name="${escapeHtml(product.name)}" class="danger-button">REMOVER DA LOJA</button>
      </article>`).join("");
  } catch (error) {
    adminProductsList.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
  }
}

async function submitMultipart(form, endpoint, successTitle) {
  const button = form.querySelector("button[type='submit']");
  const image = form.elements.image.files[0];
  if (!image || image.size > 5 * 1024 * 1024) {
    showMessage("Imagem inválida", "Escolhe uma imagem JPG, PNG ou WebP com até 5 MB.", true);
    return;
  }
  button.disabled = true;
  try {
    const result = await api(endpoint, { method: "POST", body: new FormData(form) });
    showMessage(successTitle, result.message);
    form.reset();
    const previewId = form.elements.image.dataset.preview;
    document.querySelector(`#${previewId}`).classList.add("is-hidden");
    document.querySelector(`[data-placeholder='${previewId}']`).classList.remove("is-hidden");
    return result;
  } finally {
    button.disabled = false;
  }
}

tabs.forEach((tab) => tab.addEventListener("click", () => activateTab(tab.dataset.tab)));
document.querySelectorAll("[data-go-tab]").forEach((button) => button.addEventListener("click", () => activateTab(button.dataset.goTab)));
document.querySelectorAll("[data-day-action]").forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.dayAction === "today") visibleDay = new Date();
  else visibleDay.setDate(visibleDay.getDate() + (button.dataset.dayAction === "next" ? 1 : -1));
  visibleDay.setHours(0, 0, 0, 0);
  loadBookings();
}));
agendaDate.addEventListener("change", () => {
  if (!agendaDate.value) return;
  visibleDay = localDateFromIso(agendaDate.value);
  loadBookings();
});
barberSelect.addEventListener("change", loadBookings);

bookingsList.addEventListener("click", (event) => {
  const eventCard = event.target.closest("[data-open-booking]");
  if (eventCard) {
    const booking = currentBookings.find((item) => item.id === eventCard.dataset.openBooking);
    if (booking) openBookingDetails(booking);
    return;
  }
  const column = event.target.closest("[data-create-booking-barber]");
  if (!column) return;
  const day = toIsoDate(visibleDay);
  const time = scheduleTimeFromPoint(column, event.clientY);
  openManualBooking({ barberId: column.dataset.createBookingBarber, day, time });
});

reservationSearch.addEventListener("input", renderReservations);
reservationBarber.addEventListener("change", renderReservations);
reservationDate.addEventListener("change", renderReservations);
document.querySelector("#clear-reservation-filters").addEventListener("click", () => {
  reservationSearch.value = "";
  reservationBarber.value = "";
  reservationDate.value = "";
  renderReservations();
});
reservationsList.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view-reservation]");
  if (viewButton) {
    const booking = reservations.find((entry) => entry.id === viewButton.dataset.viewReservation);
    if (booking) openBookingDetails(booking);
    return;
  }
  const cancelButton = event.target.closest("[data-cancel-reservation]");
  if (cancelButton) cancelReservation(cancelButton.dataset.cancelReservation, cancelButton);
});

bookingDetail.addEventListener("click", async (event) => {
  if (event.target.closest("[data-close-booking]")) {
    bookingDialog.close();
    return;
  }
  const button = event.target.closest("[data-cancel-booking]");
  if (button) cancelReservation(button.dataset.cancelBooking, button);
});

bookingDialog.addEventListener("click", (event) => {
  if (event.target === bookingDialog) bookingDialog.close();
});

document.querySelector("[data-open-manual-booking]").addEventListener("click", () => openManualBooking());
document.querySelector("[data-close-manual-booking]").addEventListener("click", () => manualBookingDialog.close());
manualBookingDialog.addEventListener("click", (event) => {
  if (event.target === manualBookingDialog) manualBookingDialog.close();
});
["barber_id", "service_id", "day"].forEach((name) => {
  manualBookingForm.elements[name].addEventListener("change", loadManualAvailability);
});
manualBookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = manualBookingForm.querySelector("button[type='submit']");
  const day = manualBookingForm.elements.day.value;
  const time = manualBookingForm.elements.time.value;
  if (!day || !time) return;

  submitButton.disabled = true;
  try {
    const result = await api("/api/admin/booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barber_id: manualBookingForm.elements.barber_id.value,
        service_id: manualBookingForm.elements.service_id.value,
        customer_name: manualBookingForm.elements.customer_name.value.trim(),
        customer_phone: manualBookingForm.elements.customer_phone.value.trim(),
        customer_email: manualBookingForm.elements.customer_email.value.trim(),
        starts_at: `${day}T${time}:00`,
      }),
    });
    visibleDay = localDateFromIso(day);
    preferredManualTime = "";
    manualBookingDialog.close();
    showMessage("Reserva confirmada", result.message);
    await Promise.all([loadBookings(), loadReservations(), loadDashboard()]);
  } catch (error) {
    showMessage("Não foi possível reservar", error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#barber-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const result = await submitMultipart(event.currentTarget, "/api/admin/barbers", "Barbeiro criado");
    if (result) {
      await loadBarbers();
      await loadDashboard();
    }
  } catch (error) { showMessage("Não foi possível criar", error.message, true); }
});

document.querySelector("#product-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const result = await submitMultipart(event.currentTarget, "/api/admin/products", "Produto publicado");
    if (result) await loadAdminProducts();
  } catch (error) { showMessage("Não foi possível publicar", error.message, true); }
});

adminProductsList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-remove-product]");
  if (!button) return;
  if (!confirm(`Remover “${button.dataset.productName}” da loja? O produto deixará de aparecer no site.`)) return;
  button.disabled = true;
  try {
    const result = await api(`/api/admin/products/${encodeURIComponent(button.dataset.removeProduct)}`, { method: "DELETE" });
    showMessage("Produto removido", result.message);
    await loadAdminProducts();
  } catch (error) {
    showMessage("Não foi possível remover", error.message, true);
    button.disabled = false;
  }
});

document.querySelectorAll("[data-image-input]").forEach((input) => {
  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    const preview = document.querySelector(`#${input.dataset.preview}`);
    if (preview.src.startsWith("blob:")) URL.revokeObjectURL(preview.src);
    preview.src = URL.createObjectURL(file);
    preview.classList.remove("is-hidden");
    document.querySelector(`[data-placeholder='${input.dataset.preview}']`).classList.add("is-hidden");
  });
});

document.querySelector("#logout").addEventListener("click", async () => {
  try {
    await api("/api/admin/logout", { method: "POST" });
    window.location.replace("/admin/login");
  } catch (error) {
    showMessage("Não foi possível terminar sessão", error.message, true);
  }
});

updateAgendaHeading();
const requestedTab = new URLSearchParams(window.location.search).get("tab");
if (window.location.pathname === "/admin/publish") activateTab("products");
else if (requestedTab && tabs.some((tab) => tab.dataset.tab === requestedTab)) activateTab(requestedTab);

api("/api/admin/session")
  .then(async (session) => {
    if (session.admin?.email) document.querySelector("#sidebar-admin-email").textContent = session.admin.email;
    await Promise.all([loadBarbers(), loadServices(), loadAdminProducts(), loadDashboard()]);
    if (document.querySelector("[data-tab].is-active")?.dataset.tab === "bookings") await loadBookings();
    if (document.querySelector("[data-tab].is-active")?.dataset.tab === "reservations") await loadReservations();
  })
  .catch((error) => showMessage("Erro", error.message, true));
