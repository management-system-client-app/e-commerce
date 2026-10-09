import type { Response } from "express";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { sizeGuideService } from "./sizeGuide.service";
import type {
  CreateSizeGuideInput,
  SizeGuideIdParam,
  SizeGuideListQuery,
  UpdateSizeGuideInput,
} from "./sizeGuide.validation";

const getGuides = async (
  req: ValidatedRequest<unknown, Record<string, string>, SizeGuideListQuery>,
  res: Response,
): Promise<void> => {
  const guides = await sizeGuideService.getGuides(req.validatedQuery);

  res.status(200).json({
    success: true,
    message: "Size guides fetched",
    data: guides,
  });
};

const getAllGuides = async (_req: ValidatedRequest, res: Response): Promise<void> => {
  const guides = await sizeGuideService.getAllGuides();

  res.status(200).json({
    success: true,
    message: "Size guides fetched",
    data: guides,
  });
};

const createGuide = async (
  req: ValidatedRequest<CreateSizeGuideInput>,
  res: Response,
): Promise<void> => {
  const guide = await sizeGuideService.createGuide(req.validatedBody);

  res.status(201).json({
    success: true,
    message: "Size guide created",
    data: guide,
  });
};

const updateGuide = async (
  req: ValidatedRequest<UpdateSizeGuideInput, SizeGuideIdParam>,
  res: Response,
): Promise<void> => {
  const guide = await sizeGuideService.updateGuide(req.validatedParams.id, req.validatedBody);

  res.status(200).json({
    success: true,
    message: "Size guide updated",
    data: guide,
  });
};

const deleteGuide = async (
  req: ValidatedRequest<unknown, SizeGuideIdParam>,
  res: Response,
): Promise<void> => {
  await sizeGuideService.deleteGuide(req.validatedParams.id);

  res.status(200).json({
    success: true,
    message: "Size guide deleted",
  });
};

export const sizeGuideController = {
  getGuides,
  getAllGuides,
  createGuide,
  updateGuide,
  deleteGuide,
};
