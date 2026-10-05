import type { Response } from "express";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { catalogService } from "./catalog.service";
import type {
  CatalogListQuery,
  CreateFabricInput,
  CreateSizeInput,
} from "./catalog.validation";

const getCatalog = async (_req: ValidatedRequest, res: Response): Promise<void> => {
  const catalog = await catalogService.getCatalog();

  res.status(200).json({
    success: true,
    message: "Catalog fetched",
    data: catalog,
  });
};

const createSize = async (
  req: ValidatedRequest<CreateSizeInput>,
  res: Response,
): Promise<void> => {
  const size = await catalogService.createSize(req.validatedBody);

  res.status(201).json({
    success: true,
    message: "Size created",
    data: size,
  });
};

const getSizes = async (
  req: ValidatedRequest<unknown, Record<string, string>, CatalogListQuery>,
  res: Response,
): Promise<void> => {
  const result = await catalogService.getSizes(req.validatedQuery);

  res.status(200).json({
    success: true,
    message: "Sizes fetched",
    data: result.items,
    meta: result.meta,
  });
};

const createFabric = async (
  req: ValidatedRequest<CreateFabricInput>,
  res: Response,
): Promise<void> => {
  const fabric = await catalogService.createFabric(req.validatedBody);

  res.status(201).json({
    success: true,
    message: "Fabric created",
    data: fabric,
  });
};

const getFabrics = async (
  req: ValidatedRequest<unknown, Record<string, string>, CatalogListQuery>,
  res: Response,
): Promise<void> => {
  const result = await catalogService.getFabrics(req.validatedQuery);

  res.status(200).json({
    success: true,
    message: "Fabrics fetched",
    data: result.items,
    meta: result.meta,
  });
};

export const catalogController = {
  getCatalog,
  createSize,
  getSizes,
  createFabric,
  getFabrics,
};
