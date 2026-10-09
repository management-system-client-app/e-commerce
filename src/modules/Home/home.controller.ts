import type { Response } from "express";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { homeService } from "./home.service";
import type {
  CreateHomeBlockInput,
  HomeBlockIdParam,
  UpdateHomeBlockInput,
} from "./home.validation";

const getStorefront = async (_req: ValidatedRequest, res: Response): Promise<void> => {
  const storefront = await homeService.getStorefront();

  res.status(200).json({
    success: true,
    message: "Home fetched",
    data: storefront,
  });
};

const getBlocks = async (_req: ValidatedRequest, res: Response): Promise<void> => {
  const blocks = await homeService.getBlocks();

  res.status(200).json({
    success: true,
    message: "Home blocks fetched",
    data: blocks,
  });
};

const createBlock = async (
  req: ValidatedRequest<CreateHomeBlockInput>,
  res: Response,
): Promise<void> => {
  const block = await homeService.createBlock(req.validatedBody);

  res.status(201).json({
    success: true,
    message: "Home block created",
    data: block,
  });
};

const updateBlock = async (
  req: ValidatedRequest<UpdateHomeBlockInput, HomeBlockIdParam>,
  res: Response,
): Promise<void> => {
  const block = await homeService.updateBlock(req.validatedParams.id, req.validatedBody);

  res.status(200).json({
    success: true,
    message: "Home block updated",
    data: block,
  });
};

const deleteBlock = async (
  req: ValidatedRequest<unknown, HomeBlockIdParam>,
  res: Response,
): Promise<void> => {
  await homeService.deleteBlock(req.validatedParams.id);

  res.status(200).json({
    success: true,
    message: "Home block deleted",
  });
};

export const homeController = {
  getStorefront,
  getBlocks,
  createBlock,
  updateBlock,
  deleteBlock,
};
