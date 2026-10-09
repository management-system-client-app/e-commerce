import type { Response } from "express";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { outletService } from "./outlet.service";
import type { CreateOutletInput, OutletIdParam, UpdateOutletInput } from "./outlet.validation";

const getOutlets = async (_req: ValidatedRequest, res: Response): Promise<void> => {
  const outlets = await outletService.getOutlets();

  res.status(200).json({
    success: true,
    message: "Outlets fetched",
    data: outlets,
  });
};

const getAllOutlets = async (_req: ValidatedRequest, res: Response): Promise<void> => {
  const outlets = await outletService.getAllOutlets();

  res.status(200).json({
    success: true,
    message: "Outlets fetched",
    data: outlets,
  });
};

const createOutlet = async (
  req: ValidatedRequest<CreateOutletInput>,
  res: Response,
): Promise<void> => {
  const outlet = await outletService.createOutlet(req.validatedBody);

  res.status(201).json({
    success: true,
    message: "Outlet created",
    data: outlet,
  });
};

const updateOutlet = async (
  req: ValidatedRequest<UpdateOutletInput, OutletIdParam>,
  res: Response,
): Promise<void> => {
  const outlet = await outletService.updateOutlet(req.validatedParams.id, req.validatedBody);

  res.status(200).json({
    success: true,
    message: "Outlet updated",
    data: outlet,
  });
};

const deleteOutlet = async (
  req: ValidatedRequest<unknown, OutletIdParam>,
  res: Response,
): Promise<void> => {
  await outletService.deleteOutlet(req.validatedParams.id);

  res.status(200).json({
    success: true,
    message: "Outlet deleted",
  });
};

export const outletController = {
  getOutlets,
  getAllOutlets,
  createOutlet,
  updateOutlet,
  deleteOutlet,
};
