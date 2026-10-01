import type { Response } from "express";
import { AppError } from "../../app/errors/AppError";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { reviewService } from "./review.service";
import type {
  CreateReviewInput,
  ProductReviewParam,
  ReviewListQuery,
} from "./review.validation";

const createReview = async (
  req: ValidatedRequest<CreateReviewInput>,
  res: Response,
): Promise<void> => {
  if (!req.auth || req.auth.role !== "USER") {
    throw AppError.forbidden("Only customers can review a product");
  }

  const review = await reviewService.createReview(req.auth.id, req.validatedBody);

  res.status(201).json({
    success: true,
    message: "Review submitted",
    data: review,
  });
};

const getProductReviews = async (
  req: ValidatedRequest<unknown, ProductReviewParam, ReviewListQuery>,
  res: Response,
): Promise<void> => {
  const result = await reviewService.getProductReviews(
    req.validatedParams.productId,
    req.validatedQuery,
  );

  res.status(200).json({
    success: true,
    message: "Reviews fetched",
    data: result.items,
    summary: result.summary,
    meta: result.meta,
  });
};

export const reviewController = {
  createReview,
  getProductReviews,
};
