import { Router } from "express";
import { authenticate, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { applyUploadedImage, singleImageOnlyUpload } from "../../app/middlewares/upload";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { settingsController } from "./settings.controller";
import {
  collageImageSlotSchema,
  updateSettingsSchema,
  uploadCollageImageSchema,
} from "./settings.validation";

const router = Router();

router.get("/", asyncHandler(settingsController.getSettings));

router.post(
  "/collage-images/:slot",
  authenticate,
  authorize("ADMIN"),
  singleImageOnlyUpload,
  applyUploadedImage("ecommerce/home/collage"),
  validateRequest({ params: collageImageSlotSchema, body: uploadCollageImageSchema }),
  asyncHandler(settingsController.uploadCollageImage),
);

router.put(
  "/",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ body: updateSettingsSchema }),
  asyncHandler(settingsController.updateSettings),
);

export const settingsRoutes = router;
