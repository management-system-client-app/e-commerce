import { Router } from "express";
import { authenticate } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { authRateLimiter, passwordResetRateLimiter } from "../../app/middlewares/rateLimiter";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { authController } from "./auth.controller";
import { oauthController } from "./oauth.controller";
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, verifyResetCodeSchema } from "./auth.validation";

const router = Router();

router.get("/google", authRateLimiter, asyncHandler(oauthController.startGoogle));
router.get("/google/callback", asyncHandler(oauthController.googleCallback));
router.get("/facebook", authRateLimiter, asyncHandler(oauthController.startFacebook));
router.get("/facebook/callback", asyncHandler(oauthController.facebookCallback));

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

router.post(
  "/forgot-password",
  passwordResetRateLimiter,
  validateRequest({ body: forgotPasswordSchema }),
  asyncHandler(authController.forgotPassword),
);

router.post(
  "/admin/forgot-password",
  passwordResetRateLimiter,
  validateRequest({ body: forgotPasswordSchema }),
  asyncHandler(authController.forgotAdminPassword),
);

router.post(
  "/verify-reset-code",
  passwordResetRateLimiter,
  validateRequest({ body: verifyResetCodeSchema }),
  asyncHandler(authController.verifyResetCode),
);

router.post(
  "/reset-password",
  passwordResetRateLimiter,
  validateRequest({ body: resetPasswordSchema }),
  asyncHandler(authController.resetPassword),
);

router.post("/logout", authenticate, asyncHandler(authController.logout));

export const authRoutes = router;
