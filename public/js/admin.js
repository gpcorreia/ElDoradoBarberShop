import { renderBookingCalendar } from "/components/admin-calendar.js";

const tabs = document.querySelectorAll("[data-tab]");
const panels = document.querySelectorAll("[data-panel]");
const barberSelect = document.querySelector("#booking-barber");
const bookingsList = document.querySelector("#bookings-list");
const bookingDialog = document.querySelector("#booking-detail-dialog");
const bookingDetail = document.querySelector("#booking-detail");
const adminProductsList = document.querySelector("#admin-products-list");
const messageBox = document.querySelector("#admin-message");
let messageTimer;
let currentBookings = [];

function startOfWeek(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date;
}

function initialWeek() {
  const today = new Date();
  const monday = startOfWeek(today);
  if (today.getDay() === 0) monday.setDate(monday.getDate() + 7);
  return monday;
}

let visibleWeek = initialWeek();
const firstAvailableWeek = initialWeek();

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPrice(value) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(Number(value));
}

function showMessage(title, text, error = false) {
  clearTimeout(messageTimer);
  document.querySelector("#admin-message-title").textContent = title;
  document.querySelector("#admin-message-text").textContent = text;
  messageBox.classList.toggle("border-red-800", error);
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
    tab.classList.toggle("text-muted", !active);
  });
  panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== name; });
}

async function loadBarbers() {
  const response = await fetch("/api/barbers", { headers: { Accept: "application/json" } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Não foi possível carregar os barbeiros.");
  barberSelect.innerHTML = '<option value="">Seleciona um barbeiro</option>' + result.barbers
    .map((barber) => `<option value="${escapeHtml(barber.id)}">${escapeHtml(barber.name)}</option>`)
    .join("");
}

function formatBookingDate(value) {
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

function toLocalTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function getServiceName(booking) {
  return Array.isArray(booking.services) ? booking.services[0]?.name : booking.services?.name;
}

function openBookingDetails(booking) {
  bookingDetail.innerHTML = `
    <article class="relative p-6 sm:p-8">
      <button type="button" data-close-booking class="absolute right-3 top-3 flex h-10 w-10 items-center justify-center text-muted hover:text-gold" aria-label="Fechar"><span class="material-symbols-outlined">close</span></button>
      <p class="text-[8px] font-semibold tracking-[0.2em] text-gold">DETALHES DA RESERVA</p>
      <h3 class="mt-3 pr-10 font-display text-3xl">${escapeHtml(booking.customer_name)}</h3>
      <dl class="mt-7 space-y-4 border-y border-line py-5 text-xs">
        <div class="flex justify-between gap-5"><dt class="text-muted">Serviço</dt><dd class="text-right">${escapeHtml(getServiceName(booking) || "Serviço")}</dd></div>
        <div class="flex justify-between gap-5"><dt class="text-muted">Data e hora</dt><dd class="text-right">${escapeHtml(formatBookingDate(booking.starts_at))}</dd></div>
        <div class="flex justify-between gap-5"><dt class="text-muted">Telefone</dt><dd class="text-right">${escapeHtml(booking.customer_phone || "—")}</dd></div>
        <div class="flex justify-between gap-5"><dt class="text-muted">Email</dt><dd class="break-all text-right">${escapeHtml(booking.customer_email || "—")}</dd></div>
      </dl>
      <button type="button" data-cancel-booking="${escapeHtml(booking.id)}" class="mt-6 w-full border border-red-900 px-5 py-4 text-[9px] font-bold tracking-[0.14em] text-red-300 transition hover:bg-red-950">CANCELAR RESERVA</button>
    </article>`;
  bookingDialog.showModal();
}

async function loadBookings() {
  const barberId = barberSelect.value;
  if (!barberId) {
    bookingsList.innerHTML = '<p class="border border-dashed border-line p-6 text-center text-xs text-muted">Seleciona um barbeiro para veres a agenda.</p>';
    return;
  }

  bookingsList.innerHTML = '<p class="border border-line p-10 text-center text-xs text-muted">A carregar agenda…</p>';
  try {
    const end = new Date(visibleWeek);
    end.setDate(end.getDate() + 6);
    const now = new Date();
    const start = visibleWeek.getTime() === firstAvailableWeek.getTime() && now > visibleWeek ? now : visibleWeek;
    const query = new URLSearchParams({ start: toLocalTimestamp(start), end: toLocalTimestamp(end) });
    const result = await api(`/api/admin/barbers/${encodeURIComponent(barberId)}/bookings?${query}`);
    currentBookings = result.bookings;
    renderBookingCalendar(bookingsList, {
      weekStart: visibleWeek,
      bookings: currentBookings,
      canGoPrevious: visibleWeek.getTime() > firstAvailableWeek.getTime(),
    });
  } catch (error) {
    bookingsList.innerHTML = `<p class="border border-red-900 p-6 text-center text-xs text-red-200">${escapeHtml(error.message)}</p>`;
  }
}

async function loadAdminProducts() {
  adminProductsList.innerHTML = '<p class="border border-dashed border-line p-6 text-center text-xs text-muted">A carregar produtos…</p>';

  try {
    const { products } = await api("/api/products");
    if (!products.length) {
      adminProductsList.innerHTML = '<p class="border border-dashed border-line p-6 text-center text-xs text-muted">Não existem produtos publicados.</p>';
      return;
    }

    adminProductsList.innerHTML = products.map((product) => `
      <article class="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-4 border border-line bg-ink p-3 sm:grid-cols-[64px_minmax(0,1fr)_auto]">
        <img src="${escapeHtml(product.image_url)}" alt="" class="h-14 w-14 bg-[#f2efe8] object-cover sm:h-16 sm:w-16" />
        <div class="min-w-0"><p class="truncate font-display text-lg">${escapeHtml(product.name)}</p><p class="mt-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-gold">${escapeHtml(product.category)} · ${escapeHtml(formatPrice(product.price))}</p></div>
        <button type="button" data-remove-product="${escapeHtml(product.id)}" data-product-name="${escapeHtml(product.name)}" class="col-span-2 border border-red-900 px-4 py-3 text-[8px] font-bold tracking-[0.12em] text-red-300 transition hover:bg-red-950 sm:col-span-1">REMOVER DA LOJA</button>
      </article>`).join("");
  } catch (error) {
    adminProductsList.innerHTML = `<p class="border border-red-900 p-6 text-center text-xs text-red-200">${escapeHtml(error.message)}</p>`;
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
    document.querySelector(`#${previewId}`).classList.add("hidden");
    document.querySelector(`[data-placeholder='${previewId}']`).classList.remove("hidden");
    return result;
  } finally {
    button.disabled = false;
  }
}

tabs.forEach((tab) => tab.addEventListener("click", () => activateTab(tab.dataset.tab)));
barberSelect.addEventListener("change", () => {
  visibleWeek = initialWeek();
  loadBookings();
});

bookingsList.addEventListener("click", async (event) => {
  const navigation = event.target.closest("[data-calendar-action]");
  if (navigation) {
    if (navigation.dataset.calendarAction === "next") visibleWeek.setDate(visibleWeek.getDate() + 7);
    if (navigation.dataset.calendarAction === "previous" && visibleWeek > firstAvailableWeek) visibleWeek.setDate(visibleWeek.getDate() - 7);
    if (navigation.dataset.calendarAction === "today") visibleWeek = initialWeek();
    await loadBookings();
    return;
  }

  const eventCard = event.target.closest("[data-open-booking]");
  if (!eventCard) return;
  const booking = currentBookings.find((item) => item.id === eventCard.dataset.openBooking);
  if (booking) openBookingDetails(booking);
});

bookingDetail.addEventListener("click", async (event) => {
  if (event.target.closest("[data-close-booking]")) {
    bookingDialog.close();
    return;
  }

  const button = event.target.closest("[data-cancel-booking]");
  if (!button || !confirm("Tens a certeza de que queres cancelar esta reserva? O horário ficará novamente disponível.")) return;
  button.disabled = true;
  try {
    const result = await api(`/api/admin/bookings/${encodeURIComponent(button.dataset.cancelBooking)}/cancel`, { method: "PATCH" });
    bookingDialog.close();
    showMessage("Reserva cancelada", result.message);
    await loadBookings();
  } catch (error) {
    showMessage("Não foi possível cancelar", error.message, true);
    button.disabled = false;
  }
});

bookingDialog.addEventListener("click", (event) => {
  if (event.target === bookingDialog) bookingDialog.close();
});

document.querySelector("#barber-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await submitMultipart(event.currentTarget, "/api/admin/barbers", "Barbeiro criado");
    await loadBarbers();
  } catch (error) { showMessage("Não foi possível criar", error.message, true); }
});

document.querySelector("#product-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const result = await submitMultipart(event.currentTarget, "/api/admin/products", "Produto publicado");
    if (result) await loadAdminProducts();
  }
  catch (error) { showMessage("Não foi possível publicar", error.message, true); }
});

adminProductsList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-remove-product]");
  if (!button) return;

  const productName = button.dataset.productName;
  if (!confirm(`Remover “${productName}” da loja? O produto deixará de aparecer no site.`)) return;

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
    preview.src = URL.createObjectURL(file);
    preview.classList.remove("hidden");
    document.querySelector(`[data-placeholder='${input.dataset.preview}']`).classList.add("hidden");
  });
});

document.querySelector("#logout").addEventListener("click", async () => {
  try {
    await api("/api/admin/logout", { method: "POST" });
  } finally {
    window.location.replace("/admin/login");
  }
});

api("/api/admin/session")
  .then(() => Promise.all([loadBarbers(), loadAdminProducts()]))
  .catch((error) => showMessage("Erro", error.message, true));
