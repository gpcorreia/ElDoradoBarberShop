export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function stepHeading(eyebrow, title, description) {
  return `
    <header class="step-heading mb-8 text-center sm:mb-10">
      <p class="text-[9px] font-semibold tracking-[0.24em] text-gold">${escapeHtml(eyebrow)}</p>
      <h2 class="mt-3 font-display text-3xl font-semibold sm:text-4xl">${escapeHtml(title)}</h2>
      <p class="mx-auto mt-3 max-w-xl text-xs leading-5 text-muted sm:text-sm sm:leading-6">${escapeHtml(description)}</p>
      <span class="section-rule mx-auto mt-5"></span>
    </header>
  `;
}

export function barberCard(barber, selected) {
  return `
    <button type="button" data-action="select-barber" data-id="${escapeHtml(barber.id)}" class="wizard-option barber-option ${selected ? "is-selected" : ""} group overflow-hidden bg-panel text-left">
      <span class="selection-check"><span class="material-symbols-outlined text-sm">check</span></span>
      <img data-barber-photo src="${escapeHtml(barber.photo)}" alt="${escapeHtml(barber.name)}" class="aspect-[4/5] w-full object-cover grayscale transition duration-500 group-hover:grayscale-0" />
      <span class="block p-3 text-center sm:p-4"><strong class="block font-display text-base font-medium sm:text-lg">${escapeHtml(barber.name)}</strong></span>
    </button>
  `;
}

export function serviceCard(service, selected, formattedPrice) {
  return `
    <button type="button" data-action="select-service" data-id="${escapeHtml(service.id)}" class="wizard-option service-option ${selected ? "is-selected" : ""} flex h-36 flex-col bg-panel p-4 text-left sm:h-40 sm:p-5">
      <span class="selection-check"><span class="material-symbols-outlined text-sm">check</span></span>
      <span class="material-symbols-outlined text-2xl text-gold sm:text-3xl">${escapeHtml(service.icon)}</span>
      <strong class="mt-2 block font-display text-sm font-medium uppercase leading-tight sm:text-lg">${escapeHtml(service.name)}</strong>
      <span class="mt-1 hidden text-[10px] leading-4 text-muted sm:block">${escapeHtml(service.description)}</span>
      <span class="mt-auto flex items-end justify-between gap-2 pt-2"><small class="text-[7px] tracking-[0.12em] text-muted">${service.duration} MIN</small><strong class="font-display text-lg font-medium text-gold sm:text-xl">${escapeHtml(formattedPrice)}</strong></span>
    </button>
  `;
}

export function dateCard(date, options) {
  const { isoDate, weekday, month, selected, disabled } = options;
  return `
    <button type="button" data-action="select-date" data-date="${isoDate}" ${disabled ? "disabled" : ""} class="date-card ${selected ? "is-selected" : ""} border border-line bg-ink px-1 py-3 text-center transition hover:border-gold sm:py-4">
      <span class="block text-[7px] font-semibold uppercase">${escapeHtml(weekday)}</span>
      <strong class="my-1 block font-display text-lg font-medium sm:text-xl">${date.getDate()}</strong>
      <span class="block text-[8px] font-semibold uppercase">${escapeHtml(month)}</span>
    </button>
  `;
}

export function timeButton(time, selected) {
  return `<button type="button" data-action="select-time" data-time="${escapeHtml(time)}" class="time-slot ${selected ? "is-selected" : ""} border border-line bg-ink px-2 py-3 text-xs transition hover:border-gold">${escapeHtml(time)}</button>`;
}

export function progressStep(label, index, currentStep, maxStepReached) {
  const isAvailable = index <= maxStepReached;
  const isComplete = isAvailable && index !== currentStep;
  const stateClass = isComplete ? "is-complete" : index === currentStep ? "is-active" : "";
  const icon = isComplete ? '<span class="material-symbols-outlined text-sm">check</span>' : String(index + 1);
  return `
    <button type="button" data-action="go-to-step" data-step="${index}" ${isAvailable ? "" : "disabled"} ${index === currentStep ? 'aria-current="step"' : ""} class="booking-step ${stateClass}" aria-label="${isComplete ? "Editar" : "Ir para"} ${escapeHtml(label.toLowerCase())}">
      <span class="booking-step-dot text-[9px]">${icon}</span>
      <span class="booking-step-copy">
        <span class="booking-step-kicker">PASSO ${index + 1}</span>
        <span class="booking-step-label">${escapeHtml(label)}</span>
      </span>
      ${isComplete ? '<span class="material-symbols-outlined booking-step-edit">edit</span>' : ""}
    </button>
  `;
}
