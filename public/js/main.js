function initializeNavigation() {
  const header = document.querySelector("[data-header]");
  const menuButton = document.querySelector("[data-menu-button]");
  const mobileMenu = document.querySelector("[data-mobile-menu]");
  const mobileOverlay = document.querySelector("[data-mobile-overlay]");
  const mobileClose = document.querySelector("[data-menu-close]");
  const mobileLinks = document.querySelectorAll("[data-mobile-menu] a");
  const mobileNavigationLinks = document.querySelectorAll("[data-mobile-nav]");
  const navigationLinks = document.querySelectorAll("[data-nav-link]");
  const sections = document.querySelectorAll("main section[id]");
  const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
  const isHomepage = currentPath === "/" || currentPath.endsWith("/index.html");

  function updateHeader() {
    header?.classList.toggle("is-elevated", window.scrollY > 40);
  }

  function closeMenu() {
    if (!menuButton || !mobileMenu) return;
    menuButton.setAttribute("aria-expanded", "false");
    header?.classList.remove("is-mobile-open");
    document.body.classList.remove("menu-open");
  }

  function toggleMenu() {
    if (!menuButton || !mobileMenu) return;
    const willOpen = menuButton.getAttribute("aria-expanded") !== "true";
    menuButton.setAttribute("aria-expanded", String(willOpen));
    header?.classList.toggle("is-mobile-open", willOpen);
    document.body.classList.toggle("menu-open", willOpen);
  }

  function updateActiveNavigation() {
    if (!isHomepage) return;
    let currentSection = "inicio";
    sections.forEach((section) => {
      if (window.scrollY >= section.offsetTop - 180) currentSection = section.id;
    });
    navigationLinks.forEach((link) => {
      const isActive = new URL(link.href, window.location.origin).hash === `#${currentSection}`;
      link.classList.toggle("is-active", isActive);
      link.classList.toggle("active", isActive);
    });
    mobileNavigationLinks.forEach((link) => {
      const isActive = new URL(link.href, window.location.origin).hash === `#${currentSection}`;
      link.classList.toggle("active", isActive);
      if (isActive) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  menuButton?.addEventListener("click", toggleMenu);
  mobileOverlay?.addEventListener("click", closeMenu);
  mobileClose?.addEventListener("click", closeMenu);
  mobileLinks.forEach((link) => link.addEventListener("click", closeMenu));
  window.addEventListener("scroll", () => {
    updateHeader();
    updateActiveNavigation();
  }, { passive: true });
  window.addEventListener("resize", () => {
    if (window.innerWidth >= 768) closeMenu();
  });

  const yearElement = document.querySelector("[data-current-year]");
  if (yearElement) yearElement.textContent = String(new Date().getFullYear());
  updateHeader();
  updateActiveNavigation();
}

function initializeReveals() {
  const revealElements = document.querySelectorAll(".reveal");
  const hashId = window.location.hash.slice(1);
  const hashTarget = hashId ? document.getElementById(hashId) : null;
  hashTarget?.querySelectorAll(".reveal").forEach((element) => element.classList.add("is-visible"));

  if (!("IntersectionObserver" in window)) {
    revealElements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver((entries, revealObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  revealElements.forEach((element) => {
    if (!element.classList.contains("is-visible")) observer.observe(element);
  });
}

function initializeGalleryVideos() {
  const previewVideos = [...document.querySelectorAll("#galeria video")];
  if (!previewVideos.length) return;

  previewVideos.forEach((video) => {
    video.muted = true;
    video.volume = 0;
  });

  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      });
    }, { threshold: 0.55 });

    previewVideos.forEach((video) => videoObserver.observe(video));
  }
}

function initializeHomeServicesCarousel() {
  const carousel = document.querySelector(".home-services-grid");
  const cards = carousel ? [...carousel.querySelectorAll("article")] : [];
  const mobileViewport = window.matchMedia("(max-width: 639px)");
  let animationFrame;

  if (!carousel || cards.length < 2) return;

  function updateActiveCard() {
    if (!mobileViewport.matches) {
      cards.forEach((card) => card.classList.remove("is-carousel-active"));
      return;
    }

    const carouselBounds = carousel.getBoundingClientRect();
    const carouselCenter = carouselBounds.left + (carouselBounds.width / 2);
    let closestCard = cards[0];
    let closestDistance = Number.POSITIVE_INFINITY;

    cards.forEach((card) => {
      const cardBounds = card.getBoundingClientRect();
      const cardCenter = cardBounds.left + (cardBounds.width / 2);
      const distance = Math.abs(cardCenter - carouselCenter);
      if (distance < closestDistance) {
        closestCard = card;
        closestDistance = distance;
      }
    });

    cards.forEach((card) => card.classList.toggle("is-carousel-active", card === closestCard));
  }

  function centerInitialCard() {
    if (!mobileViewport.matches) {
      carousel.scrollLeft = 0;
      updateActiveCard();
      return;
    }

    const initialCard = cards[1];
    const carouselBounds = carousel.getBoundingClientRect();
    const cardBounds = initialCard.getBoundingClientRect();
    carousel.scrollLeft += cardBounds.left - carouselBounds.left - ((carouselBounds.width - cardBounds.width) / 2);
    updateActiveCard();
  }

  carousel.addEventListener("scroll", () => {
    cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(updateActiveCard);
  }, { passive: true });

  mobileViewport.addEventListener("change", () => requestAnimationFrame(centerInitialCard));
  requestAnimationFrame(centerInitialCard);
}

document.addEventListener("layout:ready", initializeNavigation, { once: true });
initializeReveals();
initializeGalleryVideos();
initializeHomeServicesCarousel();
