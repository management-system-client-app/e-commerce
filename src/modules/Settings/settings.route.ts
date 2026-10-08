import { Router } from "express";
import { authenticate, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { settingsController } from "./settings.controller";
import { updateSettingsSchema } from "./settings.validation";

const router = Router();

router.get("/", asyncHandler(settingsController.getSettings));

router.put(
  "/",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ body: updateSettingsSchema }),
  asyncHandler(settingsController.updateSettings),
);

export const settingsRoutes = router;
