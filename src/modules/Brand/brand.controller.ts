import type { Response } from "express";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { brandService } from "./brand.service";
import type { BrandListQuery, CreateBrandInput } from "./brand.validation";

const createBrand = async (
  req: ValidatedRequest<CreateBrandInput>,
  res: Response,
): Promise<void> => {
  const brand = await brandService.createBrand(req.validatedBody);

  res.status(201).json({
    success: true,
    message: "Brand created",
    data: brand,
  });
};

const getBrands = async (
  req: ValidatedRequest<unknown, Record<string, string>, BrandListQuery>,
  res: Response,
): Promise<void> => {
  const result = await brandService.getBrands(req.validatedQuery);

  res.status(200).json({
    success: true,
    message: "Brands fetched",
    data: result.items,
    meta: result.meta,
  });
};

export const brandController = {
  createBrand,
  getBrands,
};
