import {
  barberCard,
  dateCard,
  escapeHtml,
  progressStep,
  serviceCard,
  stepHeading,
  timeButton
} from "/components/booking-components.js";

const API_CONFIG = {
  barbersUrl: "/api/barbers",
  servicesUrl: "/api/services",
  bookingUrl: "/api/booking",
  availabilityUrl: "/api/appointments"
};

const FALLBACK_BARBER_PHOTO = "/img/barber-placeholder.svg";
let barbers = [];
let services = [];
let availabilityRequestSequence = 0;
const availabilityCache = new Map();
const AVAILABILITY_CACHE_MS = 15 * 1000;

const steps = ["BARBEIRO", "SERVIÇO", "DATA E HORA", "DADOS", "CONFIRMAR"];

const state = {
  currentStep: 0,
  maxStepReached: 0,
  barber: null,
  service: null,
  date: null,
  time: null,
  dateOffset: 0,
  availableSlots: [],
  availabilityLoading: false,
  customer: { name: "", phone: "", email: "" },
  completed: false
};

const elements = {
  progress: document.querySelector("#booking-progress"),
  panel: document.querySelector("#booking-step"),
  counter: document.querySelector("#step-counter"),
  alert: document.querySelector("#booking-alert"),
  alertIcon: document.querySelector("#alert-icon"),
  alertTitle: document.querySelector("#alert-title"),
  alertMessage: document.querySelector("#alert-message"),
  closeAlert: document.querySelector("#close-alert"),
  slotConflictDialog: document.querySelector("#slot-conflict-dialog"),
  slotConflictTime: document.querySelector("#slot-conflict-time"),
  closeSlotConflict: document.querySelector("#close-slot-conflict"),
  chooseAnotherSlot: document.querySelector("#choose-another-slot")
};

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromIsoDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatPrice(price) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }).format(price);
}

function getServiceIcon(name) {
  const normalizedName = name.trim().toLowerCase();

  if (normalizedName.includes("eldorado")) return "diamond";
  if (normalizedName.includes("criança") || normalizedName.includes("crianca")) return "child_care";
  if (normalizedName.includes("sobrancelha")) return "face_retouching_natural";
  if (normalizedName.includes("barba") && normalizedName.includes("corte")) return "styler";
  if (normalizedName.includes("barba")) return "face";
  if (normalizedName.includes("styling")) return "water_drop";
  return "content_cut";
}

const SERVICE_ORDER = [
  "corte classico",
  "corte + barba",
  "barba",
  "corte + barba + sobrancelha",
  "servico eldorado",
  "corte crianca"
];

function serviceOrder(name) {
  const normalizedName = name.trim().toLocaleLowerCase("pt-PT").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const index = SERVICE_ORDER.indexOf(normalizedName);
  return index === -1 ? SERVICE_ORDER.length : index;
}

function normalizePhotoUrl(photoUrl) {
  if (!photoUrl) return FALLBACK_BARBER_PHOTO;

  try {
    const url = new URL(photoUrl, window.location.origin);
    if (url.protocol === "http:" || url.protocol === "https:") return url.href;
  } catch {
    return FALLBACK_BARBER_PHOTO;
  }

  return FALLBACK_BARBER_PHOTO;
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function fetchJson(url, { attempts = 2, timeoutMs = 12000 } = {}) {
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      let result;
      try {
        result = await response.json();
      } catch {
        const error = new Error("O servidor devolveu uma resposta temporariamente inválida.");
        error.status = 502;
        throw error;
      }

      if (response.ok) return result;

      const error = new Error(result.message ?? `Pedido falhou com o estado ${response.status}.`);
      error.status = response.status;
      lastError = error;

      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === attempts - 1) throw error;
    } catch (error) {
      lastError = error;
      const retryable = error.name === "AbortError" || error instanceof TypeError || error.status === 429 || error.status >= 500;
      if (!retryable || attempt === attempts - 1) {
        if (error.name === "AbortError") {
          throw new Error("O servidor está a demorar mais do que o esperado. Tenta novamente dentro de alguns segundos.");
        }
        if (error instanceof TypeError) {
          throw new Error("Não foi possível contactar o servidor. Verifica a ligação e tenta novamente.");
        }
        throw error;
      }
    } finally {
      window.clearTimeout(timeout);
    }

    await wait(350 * (attempt + 1));
  }

  throw lastError;
}

async function loadCatalog() {
  const [barbersResult, servicesResult] = await Promise.all([
    fetchJson(API_CONFIG.barbersUrl),
    fetchJson(API_CONFIG.servicesUrl)
  ]);

  if (!Array.isArray(barbersResult.barbers) || !Array.isArray(servicesResult.services)) {
    throw new Error("O backend devolveu um formato de catálogo inválido.");
  }

  barbers = barbersResult.barbers.map((barber) => ({
    id: barber.id,
    name: barber.name,
    photo: normalizePhotoUrl(barber.photo_url)
  }));

  services = servicesResult.services.map((service) => ({
    id: service.id,
    name: service.name.trim(),
    description: service.description?.trim() || "Serviço profissional ElDorado.",
    price: Number(service.price),
    duration: Number(service.duration_minutes),
    icon: getServiceIcon(service.name)
  })).sort((first, second) => serviceOrder(first.name) - serviceOrder(second.name));

  if (!barbers.length || !services.length) {
    throw new Error("Ainda não existem barbeiros ou serviços disponíveis.");
  }
}

function getVisibleDates() {
  const first = new Date();
  first.setHours(12, 0, 0, 0);
  first.setDate(first.getDate() + state.dateOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return date;
  });
}

function renderProgress() {
  elements.progress.innerHTML = steps.map((label, index) => progressStep(label, index, state.currentStep, state.maxStepReached)).join("");
  elements.counter.textContent = state.completed ? "CONCLUÍDO" : `PASSO ${state.currentStep + 1} DE ${steps.length}`;

  const activeStep = elements.progress.querySelector(".is-active");
  if (activeStep && elements.progress.scrollWidth > elements.progress.clientWidth) {
    requestAnimationFrame(() => elements.progress.scrollTo({
      left: activeStep.offsetLeft - ((elements.progress.clientWidth - activeStep.offsetWidth) / 2),
      behavior: "smooth"
    }));
  }
}

function renderBarberStep() {
  elements.panel.innerHTML = `
    ${stepHeading("PASSO 1", "Quem vai cuidar do teu estilo?", "Escolhe o profissional para a tua próxima visita.")}
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">${barbers.map((barber) => barberCard(barber, state.barber?.id === barber.id)).join("")}</div>
  `;
}

function renderServiceStep() {
  elements.panel.innerHTML = `
    ${stepHeading("PASSO 2", "Escolhe o teu serviço", "Seleciona a experiência que procuras. O preço e a duração ficam sempre visíveis.")}
    <aside class="booking-friend-promo" aria-label="Promoção Traz um amigo">
      <span class="material-symbols-outlined booking-friend-promo__icon" aria-hidden="true">group_add</span>
      <span class="booking-friend-promo__copy"><strong>Traz um amigo</strong><small>Recebe 2,50 € de desconto por cada amigo que realizar um serviço contigo. Aplicado na barbearia.</small></span>
      <span class="booking-friend-promo__value">−2,50 €<small>POR AMIGO</small></span>
    </aside>
    <div class="service-grid grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">${services.map((service) => serviceCard(service, state.service?.id === service.id, formatPrice(service.price))).join("")}</div>
  `;
}

function renderDateTimeStep() {
  const dates = getVisibleDates();
  const weekdayFormatter = new Intl.DateTimeFormat("pt-PT", { weekday: "short" });
  const monthFormatter = new Intl.DateTimeFormat("pt-PT", { month: "short" });
  const dateCards = dates.map((date) => dateCard(date, {
    isoDate: toIsoDate(date),
    weekday: weekdayFormatter.format(date).replace(".", ""),
    month: monthFormatter.format(date).replace(".", ""),
    selected: state.date && toIsoDate(state.date) === toIsoDate(date),
    disabled: date.getDay() === 0
  })).join("");

  let times = '<p class="col-span-full py-6 text-center text-xs text-muted">Escolhe primeiro uma data.</p>';
  if (state.date && state.availabilityLoading) {
    times = '<p class="col-span-full flex items-center justify-center gap-2 py-6 text-xs text-muted"><span class="material-symbols-outlined animate-spin text-lg text-gold">progress_activity</span>A procurar horários…</p>';
  } else if (state.date && state.availableSlots.length) {
    times = state.availableSlots.map((time) => timeButton(time, state.time === time)).join("");
  } else if (state.date) {
    times = '<p class="col-span-full py-6 text-center text-xs text-muted">Não existem horários disponíveis para este dia.</p>';
  }

  elements.panel.innerHTML = `
    ${stepHeading("PASSO 3", "Quando queres visitar-nos?", "Escolhe a data e, de seguida, um dos horários disponíveis.")}
    <div class="flex items-center justify-between gap-4">
      <h3 class="text-[9px] font-semibold tracking-[0.18em] text-gold">DATA</h3>
      <div class="flex gap-2">
        <button type="button" data-action="previous-dates" ${state.dateOffset === 0 ? "disabled" : ""} class="flex h-9 w-9 items-center justify-center border border-line text-muted hover:border-gold disabled:opacity-30"><span class="material-symbols-outlined">chevron_left</span></button>
        <button type="button" data-action="next-dates" class="flex h-9 w-9 items-center justify-center border border-line text-muted hover:border-gold"><span class="material-symbols-outlined">chevron_right</span></button>
      </div>
    </div>
    <div class="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">${dateCards}</div>
    <div class="mt-8 flex items-center justify-between"><h3 class="text-[9px] font-semibold tracking-[0.18em] text-gold">HORÁRIO</h3><span class="text-[8px] text-muted">DURAÇÃO: ${state.service.duration} MIN</span></div>
    <div class="mt-4 grid max-h-52 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-5">${times}</div>
  `;
}

function renderDetailsStep() {
  elements.panel.innerHTML = `
    ${stepHeading("PASSO 4", "Só faltam os teus dados", "Precisamos destes contactos para confirmar ou ajustar a tua marcação.")}
    <form data-form="customer" class="mx-auto max-w-xl space-y-4">
      <label class="block"><span class="mb-2 block text-[8px] font-semibold tracking-wider">NOME COMPLETO *</span><span class="booking-input-wrap"><span class="material-symbols-outlined booking-input-icon" aria-hidden="true">person</span><input name="name" value="${escapeHtml(state.customer.name)}" required minlength="2" maxlength="100" autocomplete="name" placeholder="Ex.: João Silva" class="booking-field w-full px-4 py-3 text-sm" /></span></label>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block"><span class="mb-2 block text-[8px] font-semibold tracking-wider">TELEFONE *</span><span class="booking-input-wrap"><span class="material-symbols-outlined booking-input-icon" aria-hidden="true">call</span><input name="phone" value="${escapeHtml(state.customer.phone)}" required minlength="6" maxlength="20" autocomplete="tel" type="tel" pattern="[+0-9][0-9 .()\\-]+" placeholder="912 345 678" class="booking-field w-full px-4 py-3 text-sm" /></span></label>
        <label class="block"><span class="mb-2 block text-[8px] font-semibold tracking-wider">E-MAIL *</span><span class="booking-input-wrap"><span class="material-symbols-outlined booking-input-icon" aria-hidden="true">mail</span><input name="email" value="${escapeHtml(state.customer.email)}" required maxlength="150" autocomplete="email" type="email" placeholder="exemplo@email.com" class="booking-field w-full px-4 py-3 text-sm" /></span></label>
      </div>
      <button class="mt-3 flex w-full items-center justify-center gap-3 bg-gold px-5 py-4 text-[9px] font-bold tracking-[0.2em] text-ink hover:bg-[#f3d08c]">REVER MARCAÇÃO<span class="material-symbols-outlined text-lg">arrow_forward</span></button>
    </form>
  `;
}

function renderConfirmationStep() {
  elements.panel.innerHTML = `
    ${stepHeading("ÚLTIMO PASSO", "Confirma a tua marcação", "Revê os dados abaixo antes de enviares o pedido.")}
    <div class="confirmation-card mx-auto max-w-xl border border-line bg-panel p-5 sm:p-7">
      <dl class="space-y-4 text-xs">
        <div class="flex justify-between gap-5"><dt class="text-muted">Barbeiro</dt><dd>${escapeHtml(state.barber.name)}</dd></div>
        <div class="flex justify-between gap-5"><dt class="text-muted">Serviço</dt><dd>${escapeHtml(state.service.name)}</dd></div>
        <div class="flex justify-between gap-5"><dt class="text-muted">Data e hora</dt><dd>${formatDate(state.date)} · ${state.time}</dd></div>
        <div class="flex justify-between gap-5 border-t border-line pt-4"><dt class="text-muted">Cliente</dt><dd class="text-right">${escapeHtml(state.customer.name)}<br><span class="text-muted">${escapeHtml(state.customer.email)}</span></dd></div>
        <div class="flex items-end justify-between gap-5 border-t border-line pt-4"><dt class="font-display text-lg">Total</dt><dd class="font-display text-3xl text-gold">${formatPrice(state.service.price)}</dd></div>
      </dl>
      <label class="mt-6 flex cursor-pointer items-start gap-3 text-[9px] leading-4 text-muted"><input data-terms type="checkbox" class="mt-0.5 border-line bg-ink text-gold focus:ring-gold" /><span>Aceito a <a href="/politica-privacidade" target="_blank" rel="noopener" class="underline transition hover:text-gold">Política de Privacidade</a> e os <a href="/termos-condicoes" target="_blank" rel="noopener" class="underline transition hover:text-gold">Termos e Condições</a>.</span></label>
      <button type="button" data-action="submit-booking" class="mt-5 flex w-full items-center justify-center gap-3 bg-gold px-5 py-4 text-[9px] font-bold tracking-[0.2em] text-ink hover:bg-[#f3d08c]">CONFIRMAR MARCAÇÃO<span class="material-symbols-outlined text-lg">arrow_forward</span></button>
      <p class="mt-3 flex items-center justify-center gap-2 text-[8px] text-muted"><span class="material-symbols-outlined text-sm text-gold">lock</span>Os teus dados estão seguros connosco.</p>
    </div>
  `;
}

function renderCompletedStep() {
  elements.panel.innerHTML = `
    <div class="flex min-h-[390px] flex-col items-center justify-center text-center">
      <span class="flex h-16 w-16 items-center justify-center rounded-full border border-gold text-gold"><span class="material-symbols-outlined text-4xl">check</span></span>
      <p class="mt-6 text-[9px] font-semibold tracking-[0.24em] text-gold">MARCAÇÃO CONFIRMADA</p>
      <h2 class="mt-3 font-display text-3xl font-semibold sm:text-4xl">Está tudo tratado.</h2>
      <p class="mt-4 max-w-md text-xs leading-5 text-muted">A tua marcação foi recebida com sucesso. Esperamos por ti na ElDorado.</p>
      <a href="/" class="mt-7 border border-gold px-7 py-3 text-[9px] font-semibold tracking-[0.16em] text-gold hover:bg-gold hover:text-ink">VOLTAR AO INÍCIO</a>
    </div>
  `;
}

function renderCurrentStep() {
  renderProgress();
  elements.panel.classList.remove("wizard-panel");
  void elements.panel.offsetWidth;
  elements.panel.classList.add("wizard-panel");

  if (state.completed) renderCompletedStep();
  else if (state.currentStep === 0) renderBarberStep();
  else if (state.currentStep === 1) renderServiceStep();
  else if (state.currentStep === 2) renderDateTimeStep();
  else if (state.currentStep === 3) renderDetailsStep();
  else renderConfirmationStep();

}

function goToStep(step) {
  state.currentStep = Math.max(0, Math.min(step, steps.length - 1));
  state.maxStepReached = Math.max(state.maxStepReached, state.currentStep);
  renderCurrentStep();
  elements.panel.scrollTop = 0;
}

async function loadAvailability({ force = false } = {}) {
  state.time = null;
  if (!state.date || !state.barber || !state.service) return false;

  const date = toIsoDate(state.date);
  const requestId = ++availabilityRequestSequence;
  const cacheKey = `${state.barber.id}:${state.service.id}:${date}`;
  const cached = availabilityCache.get(cacheKey);
  state.availabilityLoading = true;

  if (!force && cached && Date.now() - cached.createdAt < AVAILABILITY_CACHE_MS) {
    state.availableSlots = cached.slots;
    state.availabilityLoading = false;
    return true;
  }

  const query = new URLSearchParams({ service_id: state.service.id });
  try {
    const result = await fetchJson(`${API_CONFIG.availabilityUrl}/${encodeURIComponent(state.barber.id)}/${date}?${query}`, {
      attempts: 2,
      timeoutMs: 10000
    });
    if (requestId !== availabilityRequestSequence) return false;

    const slots = result.available_slots ?? result.appointments ?? [];
    state.availableSlots = slots;
    availabilityCache.set(cacheKey, { slots, createdAt: Date.now() });
    return true;
  } finally {
    if (requestId === availabilityRequestSequence) state.availabilityLoading = false;
  }
}

function buildBookingPayload() {
  return {
    barber_id: state.barber.id,
    service_id: state.service.id,
    customer_name: state.customer.name,
    customer_email: state.customer.email,
    customer_phone: state.customer.phone,
    starts_at: `${toIsoDate(state.date)}T${state.time}:00`
  };
}

async function sendBooking(payload) {
  const response = await fetch(API_CONFIG.bookingUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.message ?? "Não foi possível concluir a marcação.");
    error.status = response.status;
    throw error;
  }
  return result;
}

function showAlert(title, message, error = false) {
  elements.alertTitle.textContent = title;
  elements.alertMessage.textContent = message;
  elements.alertIcon.textContent = error ? "error" : "info";
  elements.alertIcon.classList.toggle("text-red-300", error);
  elements.alert.classList.add("is-visible");
}

function showSlotConflict(time) {
  elements.slotConflictTime.textContent = time ? `das ${time}` : "selecionado";
  if (!elements.slotConflictDialog.open) elements.slotConflictDialog.showModal();
}

function closeSlotConflict() {
  if (elements.slotConflictDialog.open) elements.slotConflictDialog.close();
}

async function initializeBooking() {
  elements.counter.textContent = "A CARREGAR";
  elements.progress.innerHTML = steps.map((label, index) => progressStep(label, index, 0, 0)).join("");
  elements.panel.innerHTML = `
    <div class="flex min-h-[390px] flex-col items-center justify-center text-center">
      <span class="material-symbols-outlined animate-spin text-4xl text-gold">progress_activity</span>
      <p class="mt-4 text-[9px] font-semibold tracking-[0.2em] text-muted">A CARREGAR BARBEIROS E SERVIÇOS</p>
    </div>
  `;

  try {
    await loadCatalog();
    renderCurrentStep();
  } catch (error) {
    elements.progress.innerHTML = "";
    elements.counter.textContent = "INDISPONÍVEL";
    elements.panel.innerHTML = `
      <div class="flex min-h-[390px] flex-col items-center justify-center text-center">
        <span class="material-symbols-outlined text-4xl text-red-300">cloud_off</span>
        <h2 class="mt-4 font-display text-2xl">Não foi possível carregar a marcação</h2>
        <p class="mt-3 max-w-md text-xs leading-5 text-muted">${escapeHtml(error.message)}</p>
        <button type="button" data-action="retry-catalog" class="mt-6 border border-gold px-6 py-3 text-[9px] font-semibold tracking-[0.16em] text-gold hover:bg-gold hover:text-ink">TENTAR NOVAMENTE</button>
      </div>
    `;
  }
}

elements.panel.addEventListener("click", async (event) => {
  const control = event.target.closest("[data-action]");
  if (!control) return;
  const { action } = control.dataset;

  if (action === "retry-catalog") {
    await initializeBooking();
  } else if (action === "select-barber") {
    availabilityRequestSequence += 1;
    state.barber = barbers.find((barber) => barber.id === control.dataset.id);
    state.date = null;
    state.time = null;
    state.availableSlots = [];
    state.availabilityLoading = false;
    state.maxStepReached = Math.min(state.maxStepReached, state.service ? 2 : 1);
    goToStep(1);
  } else if (action === "select-service") {
    availabilityRequestSequence += 1;
    state.service = services.find((service) => service.id === control.dataset.id);
    state.date = null;
    state.time = null;
    state.availableSlots = [];
    state.availabilityLoading = false;
    state.maxStepReached = Math.min(state.maxStepReached, 2);
    goToStep(2);
  } else if (action === "select-date") {
    state.date = fromIsoDate(control.dataset.date);
    state.availableSlots = [];
    state.availabilityLoading = true;
    state.maxStepReached = 2;
    renderDateTimeStep();
    try {
      const applied = await loadAvailability();
      if (!applied) return;
    } catch (error) {
      state.availableSlots = [];
      showAlert("Horários indisponíveis", error.message, true);
    }
    renderDateTimeStep();
  } else if (action === "select-time") {
    state.time = control.dataset.time;
    goToStep(3);
  } else if (action === "previous-dates") {
    availabilityRequestSequence += 1;
    state.dateOffset = Math.max(0, state.dateOffset - 7);
    state.date = null;
    state.availableSlots = [];
    state.availabilityLoading = false;
    renderDateTimeStep();
  } else if (action === "next-dates") {
    availabilityRequestSequence += 1;
    state.dateOffset += 7;
    state.date = null;
    state.availableSlots = [];
    state.availabilityLoading = false;
    renderDateTimeStep();
  } else if (action === "submit-booking") {
    if (!elements.panel.querySelector("[data-terms]")?.checked) {
      showAlert("Aceitação necessária", "Aceita a Política de Privacidade e os Termos e Condições para continuar.", true);
      return;
    }
    control.disabled = true;
    try {
      await sendBooking(buildBookingPayload());
      state.completed = true;
      renderCurrentStep();
    } catch (error) {
      if (error.status === 409) {
        const unavailableTime = state.time;
        try {
          await loadAvailability({ force: true });
        } catch {
          state.time = null;
          state.availableSlots = [];
        }
        goToStep(2);
        showSlotConflict(unavailableTime);
        return;
      }

      showAlert("Não foi possível reservar", error.message, true);
      control.disabled = false;
    }
  }
});

elements.panel.addEventListener("submit", (event) => {
  if (!event.target.matches('[data-form="customer"]')) return;
  event.preventDefault();
  if (!event.target.reportValidity()) return;
  const formData = new FormData(event.target);
  state.customer = {
    name: String(formData.get("name")).trim(),
    phone: String(formData.get("phone")).trim(),
    email: String(formData.get("email")).trim()
  };
  goToStep(4);
});

elements.progress.addEventListener("click", (event) => {
  const control = event.target.closest('[data-action="go-to-step"]');
  if (!control || control.disabled || state.completed) return;
  goToStep(Number(control.dataset.step));
});

elements.closeAlert.addEventListener("click", () => elements.alert.classList.remove("is-visible"));
elements.closeSlotConflict.addEventListener("click", closeSlotConflict);
elements.chooseAnotherSlot.addEventListener("click", closeSlotConflict);
elements.slotConflictDialog.addEventListener("click", (event) => {
  if (event.target === elements.slotConflictDialog) closeSlotConflict();
});
document.addEventListener("error", (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.matches("[data-barber-photo]")) return;
  if (image.getAttribute("src") === FALLBACK_BARBER_PHOTO) return;
  image.src = FALLBACK_BARBER_PHOTO;
}, true);

initializeBooking();
