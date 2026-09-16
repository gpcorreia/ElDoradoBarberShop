const grid = document.querySelector("#products-grid");
const dialog = document.querySelector("#product-dialog");
const detail = document.querySelector("#product-detail");
const whatsappNumber = "351912345678";
let products = [];

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function formatPrice(value) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(Number(value));
}

function whatsappUrl(product) {
  const message = `Olá! Tenho interesse no produto ${product.name} (${formatPrice(product.price)}). Podem dar-me mais informações?`;
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function renderProducts() {
  if (!products.length) {
    grid.innerHTML = '<p class="col-span-full border border-dashed border-line p-10 text-center text-xs text-muted">Ainda não existem produtos publicados.</p>';
    return;
  }

  grid.innerHTML = products.map((product) => `<button data-product-id="${escapeHtml(product.id)}" class="product-card group overflow-hidden border border-line bg-panel text-left">
    <span class="product-image-frame bg-ink"><img data-product-image src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" class="product-image grayscale-[35%]" loading="lazy" /><small class="absolute left-4 top-4 bg-ink/85 px-3 py-2 text-[8px] font-bold uppercase tracking-[0.16em] text-gold backdrop-blur">${escapeHtml(product.category || "ElDorado")}</small></span>
    <span class="block p-5 sm:p-6"><span class="flex items-start justify-between gap-4"><strong class="font-display text-xl font-medium">${escapeHtml(product.name)}</strong><b class="shrink-0 font-display text-xl font-medium text-gold">${escapeHtml(formatPrice(product.price))}</b></span><span class="mt-3 line-clamp-2 block min-h-10 text-xs leading-5 text-muted">${escapeHtml(product.description)}</span><span class="mt-5 flex items-center gap-2 text-[9px] font-bold tracking-[0.14em] text-gold">VER PRODUTO <span class="material-symbols-outlined text-base">arrow_forward</span></span></span>
  </button>`).join("");
}

function openProduct(product) {
  detail.innerHTML = `<article class="relative grid md:grid-cols-2"><button data-close-dialog class="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center bg-ink/80 text-gold" aria-label="Fechar"><span class="material-symbols-outlined">close</span></button><div class="product-image-frame bg-ink"><img data-product-image src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" class="product-image" /></div><div class="flex flex-col p-6 sm:p-9"><p class="text-[9px] uppercase tracking-[0.22em] text-gold">${escapeHtml(product.category || "Seleção ElDorado")}</p><h2 class="mt-3 font-display text-3xl">${escapeHtml(product.name)}</h2><p class="mt-5 text-sm leading-6 text-muted">${escapeHtml(product.description)}</p><p class="mt-7 font-display text-3xl text-gold">${escapeHtml(formatPrice(product.price))}</p><a href="${escapeHtml(whatsappUrl(product))}" target="_blank" rel="noreferrer" class="mt-8 flex items-center justify-center gap-3 bg-gold px-5 py-4 text-[9px] font-bold tracking-[0.14em] text-ink">TENHO INTERESSE · WHATSAPP <span class="material-symbols-outlined text-lg">chat</span></a><small class="mt-3 text-center text-[8px] leading-4 text-muted">A compra e a disponibilidade são confirmadas diretamente com a barbearia.</small></div></article>`;
  dialog.showModal();
}

grid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-product-id]");
  if (!card) return;
  const product = products.find((item) => item.id === card.dataset.productId);
  if (product) openProduct(product);
});

detail.addEventListener("click", (event) => { if (event.target.closest("[data-close-dialog]")) dialog.close(); });
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });

fetch("/api/products", { headers: { Accept: "application/json" } })
  .then(async (response) => {
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Não foi possível carregar os produtos.");
    products = Array.isArray(result.products) ? result.products : [];
    renderProducts();
  })
  .catch((error) => {
    grid.innerHTML = `<p class="col-span-full border border-red-900 p-10 text-center text-xs text-red-200">${escapeHtml(error.message)}</p>`;
  });

document.addEventListener("error", (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.matches("[data-product-image]")) return;
  if (image.src.endsWith("/img/logo.webp")) return;
  image.src = "/img/logo.webp";
  image.classList.add("is-fallback");
}, true);
