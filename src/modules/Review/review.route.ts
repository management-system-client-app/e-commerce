import { Router } from "express";
import { authenticate, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { reviewController } from "./review.controller";
import {
  createReviewSchema,
  productReviewParamSchema,
  reviewListQuerySchema,
} from "./review.validation";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize("USER"),
  validateRequest({ body: createReviewSchema }),
  asyncHandler(reviewController.createReview),
);

router.get(
  "/products/:productId",
  validateRequest({
    params: productReviewParamSchema,
    query: reviewListQuerySchema,
  }),
  asyncHandler(reviewController.getProductReviews),
);

export const reviewRoutes = router;
