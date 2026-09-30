import { Router } from "express";
import path from "path";
import { getPublicPath } from "../config/paths";
import { env } from "../config/env";
import { protectAdminPage } from "../middleware/auth.middleware";

const router = Router();
const publicDir = getPublicPath();

router.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

router.get("/index.html", (_req, res) => res.redirect(308, "/"));

router.get("/reserva", (_req, res) => {
  res.sendFile(path.join(publicDir, "booking.html"));
});

router.get(["/booking", "/booking.html"], (_req, res) => res.redirect(308, "/reserva"));

router.get("/servicos", (_req, res) => {
  res.sendFile(path.join(publicDir, "services.html"));
});

router.get("/services.html", (_req, res) => res.redirect(308, "/servicos"));

router.get("/sobre-nos", (_req, res) => {
  res.sendFile(path.join(publicDir, "about.html"));
});

router.get("/about.html", (_req, res) => res.redirect(308, "/sobre-nos"));

router.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send([
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    `Sitemap: ${env.appOrigin}/sitemap.xml`,
    "",
  ].join("\n"));
});

router.get("/sitemap.xml", (_req, res) => {
  const urls = ["/", "/reserva", "/servicos", "/sobre-nos", "/produtos"];
  const entries = urls
    .map((url) => `  <url><loc>${env.appOrigin}${url}</loc></url>`)
    .join("\n");
  res.type("application/xml").send([
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    "</urlset>",
    "",
  ].join("\n"));
});

router.get("/produtos", (_req, res) => {
  res.sendFile(path.join(publicDir, "products.html"));
});

router.get("/products.html", (_req, res) => res.redirect(308, "/produtos"));

router.get("/politica-privacidade", (_req, res) => {
  res.sendFile(path.join(publicDir, "privacy.html"));
});

router.get("/privacy.html", (_req, res) => res.redirect(308, "/politica-privacidade"));

router.get("/termos-condicoes", (_req, res) => {
  res.sendFile(path.join(publicDir, "terms.html"));
});

router.get("/terms.html", (_req, res) => res.redirect(308, "/termos-condicoes"));

router.get(["/admin/login", "/admin-login.html"], (_req, res) => {
  res.set("X-Robots-Tag", "noindex, nofollow");
  res.sendFile(path.join(publicDir, "admin-login.html"));
});

router.get(["/admin", "/admin.html", "/admin/publish"], protectAdminPage, (_req, res) => {
  res.set("X-Robots-Tag", "noindex, nofollow");
  res.sendFile(path.join(publicDir, "admin.html"));
});

export default router;
