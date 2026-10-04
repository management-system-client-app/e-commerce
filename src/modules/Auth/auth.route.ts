import { Router } from "express";
import { authenticate } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { authRateLimiter } from "../../app/middlewares/rateLimiter";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { authController } from "./auth.controller";
import { loginSchema } from "./auth.validation";

const router = Router();

router.post(
  "/login",
  authRateLimiter,
  validateRequest({ body: loginSchema }),
  asyncHandler(authController.login),
);

router.post(
  "/admin/login",
  authRateLimiter,
  validateRequest({ body: loginSchema }),
  asyncHandler(authController.loginAdmin),
);

router.post("/logout", authenticate, asyncHandler(authController.logout));

export const authRoutes = router;
