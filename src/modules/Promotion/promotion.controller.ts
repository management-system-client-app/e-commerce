import type { Response } from "express";
import { AppError } from "../../app/errors/AppError";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { readCartSessionId } from "../Cart/cart.session";
import { promotionService } from "./promotion.service";
import type {
  CreatePromotionInput,
  PromotionIdParam,
  PromotionListQuery,
  QuotePromotionInput,
  UpdatePromotionInput,
} from "./promotion.validation";

const getActivePromotions = async (_req: ValidatedRequest, res: Response): Promise<void> => {
  const promotions = await promotionService.getActivePromotions();

  res.status(200).json({
    success: true,
    message: "Promotions fetched",
    data: promotions,
  });
};

const getPromotions = async (
  req: ValidatedRequest<unknown, Record<string, string>, PromotionListQuery>,
  res: Response,
): Promise<void> => {
  const result = await promotionService.getPromotions(req.validatedQuery);

  res.status(200).json({
    success: true,
    message: "Promotions fetched",
    data: result.items,
    meta: result.meta,
  });
};

const createPromotion = async (
  req: ValidatedRequest<CreatePromotionInput>,
  res: Response,
): Promise<void> => {
  const promotion = await promotionService.createPromotion(req.validatedBody);

  res.status(201).json({
    success: true,
    message: "Promotion created",
    data: promotion,
  });
};

const updatePromotion = async (
  req: ValidatedRequest<UpdatePromotionInput, PromotionIdParam>,
  res: Response,
): Promise<void> => {
  const promotion = await promotionService.updatePromotion(req.validatedParams.id, req.validatedBody);

  res.status(200).json({
    success: true,
    message: "Promotion updated",
    data: promotion,
  });
};

const deletePromotion = async (
  req: ValidatedRequest<unknown, PromotionIdParam>,
  res: Response,
): Promise<void> => {
  await promotionService.deletePromotion(req.validatedParams.id);

  res.status(200).json({
    success: true,
    message: "Promotion deleted",
  });
};

const quoteCart = async (
  req: ValidatedRequest<QuotePromotionInput>,
  res: Response,
): Promise<void> => {
  if (req.auth?.role === "ADMIN") {
    throw AppError.forbidden("Only customers can quote a cart");
  }

  const owner =
    req.auth?.role === "USER"
      ? { kind: "user" as const, userId: req.auth.id }
      : { kind: "guest" as const, sessionId: readCartSessionId(req) ?? "" };

  if (owner.kind === "guest" && !owner.sessionId) {
    throw AppError.badRequest("Your cart is empty");
  }

  const quote = await promotionService.quoteCart(owner, req.validatedBody.couponCode);

  res.status(200).json({
    success: true,
    message: "Cart quote fetched",
    data: quote,
  });
};

export const promotionController = {
  getActivePromotions,
  getPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  quoteCart,
};
