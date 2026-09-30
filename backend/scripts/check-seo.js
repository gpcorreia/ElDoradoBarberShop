const fs = require("node:fs");
const path = require("node:path");

const publicDir = path.resolve(__dirname, "../../public");
const routeFile = path.resolve(__dirname, "../src/routes/page.routes.ts");
const failures = [];

const pages = [
  { file: "index.html", canonical: "/", title: "ElDorado Barbershop" },
  { file: "booking.html", canonical: "/reserva", title: "Reserva agora" },
  { file: "services.html", canonical: "/servicos", title: "Serviços" },
  { file: "about.html", canonical: "/sobre-nos", title: "Sobre nós" },
  { file: "products.html", canonical: "/produtos", title: "Produtos" },
];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

for (const page of pages) {
  const filename = path.join(publicDir, page.file);
  expect(fs.existsSync(filename), `${page.file}: ficheiro inexistente`);
  if (!fs.existsSync(filename)) continue;

  const html = fs.readFileSync(filename, "utf8");
  expect(/<html\b[^>]*\blang="pt"/i.test(html), `${page.file}: falta lang="pt"`);
  expect(/<title>[^<]+<\/title>/i.test(html), `${page.file}: falta um title válido`);
  expect(html.includes(page.title), `${page.file}: o title não identifica "${page.title}"`);
  expect(/<meta\s+name="description"\s+content="[^"]+"/i.test(html), `${page.file}: falta meta description`);
  expect(/<meta\s+name="robots"\s+content="[^"]*index[^"]*follow[^"]*"/i.test(html), `${page.file}: falta robots index,follow`);
  expect(html.includes(`<link rel="canonical" href="https://www.eldoradobarbershop.com${page.canonical}"`), `${page.file}: canonical deve usar o domÃ­nio oficial e ${page.canonical}`);
  expect(/<meta\s+property="og:title"\s+content="[^"]+"/i.test(html), `${page.file}: falta og:title`);
  expect(/<meta\s+property="og:description"\s+content="[^"]+"/i.test(html), `${page.file}: falta og:description`);
  expect(html.includes(`property="og:url" content="https://www.eldoradobarbershop.com${page.canonical}"`), `${page.file}: og:url deve usar o URL oficial`);
  expect(/<meta\s+name="twitter:card"\s+content="summary_large_image"/i.test(html), `${page.file}: falta Twitter Card`);
  expect(html.includes('<script src="/js/seo.js" defer></script>'), `${page.file}: falta /js/seo.js`);
  expect(/<h1\b[^>]*>.*?<\/h1>/is.test(html), `${page.file}: falta H1`);
}

const navbar = fs.readFileSync(path.join(publicDir, "components/navbar.html"), "utf8");
for (const href of ["/reserva", "/servicos", "/sobre-nos"]) {
  expect(navbar.includes(`href="${href}"`), `navbar: falta link para ${href}`);
}

const routes = fs.readFileSync(routeFile, "utf8");
for (const route of ["/reserva", "/servicos", "/sobre-nos", "/robots.txt", "/sitemap.xml"]) {
  expect(routes.includes(`"${route}"`), `page.routes.ts: falta rota ${route}`);
}
for (const sitemapUrl of ["/", "/reserva", "/servicos", "/sobre-nos", "/produtos"]) {
  expect(routes.includes(`"${sitemapUrl}"`), `sitemap: falta ${sitemapUrl}`);
}

if (failures.length) {
  console.error("Validação SEO falhou:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`SEO validado: ${pages.length} páginas indexáveis, navegação, robots.txt e sitemap.xml.`);
