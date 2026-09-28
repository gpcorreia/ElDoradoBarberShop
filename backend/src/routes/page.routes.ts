import { Router } from "express";
import path from "path";
import { getPublicPath } from "../config/paths";
import { protectAdminPage } from "../middleware/auth.middleware";

const router = Router();
const publicDir = getPublicPath();

router.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});


router.get("/booking", (req, res) => {
  res.sendFile(path.join(publicDir, "booking.html"));
});

router.get("/produtos", (_req, res) => {
  res.sendFile(path.join(publicDir, "products.html"));
});

router.get("/politica-privacidade", (_req, res) => {
  res.sendFile(path.join(publicDir, "privacy.html"));
});

router.get("/termos-condicoes", (_req, res) => {
  res.sendFile(path.join(publicDir, "terms.html"));
});

router.get(["/admin/login", "/admin-login.html"], (_req, res) => {
  res.sendFile(path.join(publicDir, "admin-login.html"));
});

router.get(["/admin", "/admin.html", "/admin/publish"], protectAdminPage, (_req, res) => {
  res.sendFile(path.join(publicDir, "admin.html"));
});

export default router;
