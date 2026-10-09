import { Router } from "express";
import { authenticate, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { sizeGuideController } from "./sizeGuide.controller";
import {
  createSizeGuideSchema,
  sizeGuideIdParamSchema,
  sizeGuideListQuerySchema,
  updateSizeGuideSchema,
} from "./sizeGuide.validation";

const router = Router();

router.get(
  "/",
  validateRequest({ query: sizeGuideListQuerySchema }),
  asyncHandler(sizeGuideController.getGuides),
);

router.get(
  "/manage",
  authenticate,
  authorize("ADMIN"),
  asyncHandler(sizeGuideController.getAllGuides),
);

router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ body: createSizeGuideSchema }),
  asyncHandler(sizeGuideController.createGuide),
);

router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateRequest({
    params: sizeGuideIdParamSchema,
    body: updateSizeGuideSchema,
  }),
  asyncHandler(sizeGuideController.updateGuide),
);

router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ params: sizeGuideIdParamSchema }),
  asyncHandler(sizeGuideController.deleteGuide),
);

export const sizeGuideRoutes = router;
