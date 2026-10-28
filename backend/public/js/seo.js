const origin = window.location.origin;
const normalizedPath = window.location.pathname.replace(/\/$/, "") || "/";

const pageNames = {
  "/": "ElDorado Barbershop",
  "/reserva": "Reserva agora",
  "/servicos": "Serviços",
  "/sobre-nos": "Sobre nós",
  "/produtos": "Produtos",
};

const canonical = document.querySelector('link[rel="canonical"]');
if (canonical) canonical.href = new URL(canonical.getAttribute("href") || normalizedPath, origin).href;

const openGraphUrl = document.querySelector('meta[property="og:url"]');
if (openGraphUrl) openGraphUrl.content = new URL(normalizedPath, origin).href;

const openGraphImage = document.querySelector('meta[property="og:image"]');
if (openGraphImage) openGraphImage.content = new URL("/img/logo.webp", origin).href;

const graph = [
  {
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    url: `${origin}/`,
    name: "ElDorado Barbershop",
    inLanguage: "pt-PT",
  },
  {
    "@type": "HairSalon",
    "@id": `${origin}/#barbershop`,
    name: "ElDorado Barbershop",
    url: `${origin}/`,
    image: `${origin}/img/logo.webp`,
    logo: `${origin}/img/logo.webp`,
    telephone: "+351913457840",
    email: "eldoradon1.26@gmail.com",
    priceRange: "€€",
    currenciesAccepted: "EUR",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Avenida 25 de Abril, Loja 1, R/C",
      postalCode: "3050-334",
      addressLocality: "Mealhada",
      addressCountry: "PT",
    },
    sameAs: [
      "https://www.instagram.com/eldorado_barbershop/",
      "https://www.facebook.com/p/Eldorado-BarberShop-61567184991995/",
    ],
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        opens: "08:00",
        closes: "22:00",
      },
    ],
    potentialAction: {
      "@type": "ReserveAction",
      target: `${origin}/reserva`,
      name: "Reserva agora",
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Serviços de barbearia",
      itemListElement: ["Corte de cabelo", "Barba", "Corte e barba", "Styling"].map((name) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name },
      })),
    },
  },
  {
    "@type": "SiteNavigationElement",
    name: ["Reserva agora", "Serviços", "Sobre nós", "Produtos"],
    url: ["/reserva", "/servicos", "/sobre-nos", "/produtos"].map((path) => `${origin}${path}`),
  },
];

if (normalizedPath !== "/" && pageNames[normalizedPath]) {
  graph.push({
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${origin}/` },
      { "@type": "ListItem", position: 2, name: pageNames[normalizedPath], item: `${origin}${normalizedPath}` },
    ],
  });
}

const structuredData = document.createElement("script");
structuredData.type = "application/ld+json";
structuredData.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
document.head.append(structuredData);
