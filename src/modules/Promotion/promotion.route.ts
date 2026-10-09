import { Router } from "express";
import { authenticate, authenticateOptional, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { promotionController } from "./promotion.controller";
import {
  createPromotionSchema,
  promotionIdParamSchema,
  promotionListQuerySchema,
  quotePromotionSchema,
  updatePromotionSchema,
} from "./promotion.validation";

const router = Router();

router.get("/active", asyncHandler(promotionController.getActivePromotions));

router.post(
  "/quote",
  authenticateOptional,
  validateRequest({ body: quotePromotionSchema }),
  asyncHandler(promotionController.quoteCart),
);

router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ body: createPromotionSchema }),
  asyncHandler(promotionController.createPromotion),
);

router.get(
  "/",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ query: promotionListQuerySchema }),
  asyncHandler(promotionController.getPromotions),
);

router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateRequest({
    params: promotionIdParamSchema,
    body: updatePromotionSchema,
  }),
  asyncHandler(promotionController.updatePromotion),
);

router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ params: promotionIdParamSchema }),
  asyncHandler(promotionController.deletePromotion),
);

export const promotionRoutes = router;
