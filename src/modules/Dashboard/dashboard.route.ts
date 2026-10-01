import { Router } from "express";
import { authenticate, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { dashboardController } from "./dashboard.controller";

const router = Router();

router.get(
  "/",
  authenticate,
  authorize("ADMIN"),
  asyncHandler(dashboardController.getOverview),
);

export const dashboardRoutes = router;
