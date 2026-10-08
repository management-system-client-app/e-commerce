import type { Response } from "express";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { variantService } from "./variant.service";
import type {
  CreateVariantInput,
  UpdateVariantInput,
  VariantIdParam,
  VariantListQuery,
} from "./variant.validation";

const createVariant = async (
  req: ValidatedRequest<CreateVariantInput>,
  res: Response,
): Promise<void> => {
  const variant = await variantService.createVariant(req.validatedBody);

  res.status(201).json({
    success: true,
    message: "Variant created",
    data: variant,
  });
};

const getAllVariants = async (
  req: ValidatedRequest<unknown, Record<string, string>, VariantListQuery>,
  res: Response,
): Promise<void> => {
  const result = await variantService.getAllVariants(req.validatedQuery);

  res.status(200).json({
    success: true,
    message: "Variants fetched",
    data: result.items,
    meta: result.meta,
  });
};

const getSingleVariant = async (
  req: ValidatedRequest<unknown, VariantIdParam>,
  res: Response,
): Promise<void> => {
  const { id } = req.validatedParams;
  const variant = await variantService.getSingleVariant(id);

  res.status(200).json({
    success: true,
    message: "Variant fetched",
    data: variant,
  });
};

const updateVariant = async (
  req: ValidatedRequest<UpdateVariantInput, VariantIdParam>,
  res: Response,
): Promise<void> => {
  const { id } = req.validatedParams;
  const variant = await variantService.updateVariant(id, req.validatedBody);

  res.status(200).json({
    success: true,
    message: "Variant updated",
    data: variant,
  });
};

const deleteVariant = async (
  req: ValidatedRequest<unknown, VariantIdParam>,
  res: Response,
): Promise<void> => {
  const { id } = req.validatedParams;
  const result = await variantService.deleteVariant(id);

  res.status(200).json({
    success: true,
    message: result.deactivated
      ? "Variant deactivated. It stays on past orders and is hidden from the shop."
      : "Variant deleted",
    data: result,
  });
};

export const variantController = {
  createVariant,
  getAllVariants,
  getSingleVariant,
  updateVariant,
  deleteVariant,
};
