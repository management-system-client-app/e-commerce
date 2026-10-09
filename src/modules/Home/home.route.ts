import { Router } from "express";
import { authenticate, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { applyUploadedImage, parseMultipartData, singleHomeMediaUpload } from "../../app/middlewares/upload";
import { homeController } from "./home.controller";
import {
  createHomeBlockSchema,
  homeBlockIdParamSchema,
  updateHomeBlockSchema,
} from "./home.validation";

const router = Router();

router.get("/", asyncHandler(homeController.getStorefront));

router.get(
  "/blocks",
  authenticate,
  authorize("ADMIN"),
  asyncHandler(homeController.getBlocks),
);

router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  singleHomeMediaUpload,
  parseMultipartData,
  applyUploadedImage("ecommerce/home"),
  validateRequest({ body: createHomeBlockSchema }),
  asyncHandler(homeController.createBlock),
);

router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  singleHomeMediaUpload,
  parseMultipartData,
  applyUploadedImage("ecommerce/home"),
  validateRequest({
    params: homeBlockIdParamSchema,
    body: updateHomeBlockSchema,
  }),
  asyncHandler(homeController.updateBlock),
);

router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ params: homeBlockIdParamSchema }),
  asyncHandler(homeController.deleteBlock),
);

export const homeRoutes = router;
