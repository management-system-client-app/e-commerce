import { Router } from "express";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { authController } from "./auth.controller";
import { loginSchema } from "./auth.validation";

const router = Router();

router.post(
  "/login",
  validateRequest({ body: loginSchema }),
  asyncHandler(authController.login),
);

router.post(
  "/admin/login",
  validateRequest({ body: loginSchema }),
  asyncHandler(authController.loginAdmin),
);

export const authRoutes = router;
