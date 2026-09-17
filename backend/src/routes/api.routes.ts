import { Router } from "express";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import {handleBooking, handleGetBarbers, handleGetServices, searchAppointmentsAvailable} from "../controllers/bookingController";
import { handleBarberCreation } from "../controllers/barbersControllers";
import { getAdminSession, loginAdmin, logoutAdmin } from "../controllers/authController";
import { handleCancelBooking, handleGetBarberBookings } from "../controllers/adminBookingsController";
import { handleCreateProduct, handleDeactivateProduct, handleGetProducts } from "../controllers/productsController";
import { protectAdmin } from "../middleware/auth.middleware";
import { requireSameOrigin } from "../middleware/security.middleware";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 5,
    parts: 6,
    fieldNameSize: 50,
    fieldSize: 10 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    const accepted = acceptedTypes.has(file.mimetype);
    if (accepted) callback(null, true);
    else callback(new Error("Formato de imagem inválido."));
  },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 180,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Demasiados pedidos. Tenta novamente dentro de alguns instantes." },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Demasiadas tentativas de acesso. Tenta novamente dentro de 15 minutos." },
});

const bookingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Foram efetuadas demasiadas tentativas de marcação. Aguarda alguns minutos." },
});

router.use(apiLimiter);
router.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

router.post("/booking", requireSameOrigin, bookingLimiter, handleBooking);

router.get("/appointments/:barber_id/:day", searchAppointmentsAvailable);

router.get("/barbers", handleGetBarbers);
router.get("/services", handleGetServices);
router.get("/products", handleGetProducts);

router.post("/admin/login", requireSameOrigin, loginLimiter, loginAdmin);
router.get("/admin/session", protectAdmin, getAdminSession);
router.post("/admin/logout", protectAdmin, requireSameOrigin, logoutAdmin);
router.post("/admin/barbers", protectAdmin, requireSameOrigin, upload.single("image"), handleBarberCreation);
router.get("/admin/barbers/:barberId/bookings", protectAdmin, handleGetBarberBookings);
router.patch("/admin/bookings/:bookingId/cancel", protectAdmin, requireSameOrigin, handleCancelBooking);
router.post("/admin/products", protectAdmin, requireSameOrigin, upload.single("image"), handleCreateProduct);
router.delete("/admin/products/:productId", protectAdmin, requireSameOrigin, handleDeactivateProduct);

export default router;
