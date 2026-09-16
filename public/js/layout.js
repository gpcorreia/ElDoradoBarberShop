async function loadFragment(selector, url) {
  const target = document.querySelector(selector);
  if (!target) return;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Não foi possível carregar ${url}.`);
  target.outerHTML = await response.text();
}

function getCurrentPage() {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  if (path === "/produtos" || path.endsWith("/products.html")) return "products";
  if (path === "/booking" || path.endsWith("/booking.html")) return "booking";
  if (path === "/politica-privacidade" || path.endsWith("/privacy.html")) return "privacy";
  if (path === "/termos-condicoes" || path.endsWith("/terms.html")) return "terms";
  return "home";
}

function markCurrentPage() {
  const currentPage = getCurrentPage();
  if (currentPage !== "home") {
    document.querySelectorAll(`[data-page="${currentPage}"]`).forEach((link) => {
      link.classList.add("active", "is-active");
      link.setAttribute("aria-current", "page");
    });
  }

  const legalLink = document.querySelector(`[data-legal-link="${currentPage}"]`);
  if (legalLink) {
    legalLink.classList.add("text-gold");
    legalLink.setAttribute("aria-current", "page");
  }
}

async function loadLayout() {
  try {
    await Promise.all([
      loadFragment("[data-navbar-slot]", "/components/navbar.html"),
      loadFragment("[data-footer-slot]", "/components/footer.html"),
    ]);
    markCurrentPage();
  } catch (error) {
    console.error("Erro ao carregar o layout:", error);
  } finally {
    document.dispatchEvent(new CustomEvent("layout:ready"));
  }
}

loadLayout();
