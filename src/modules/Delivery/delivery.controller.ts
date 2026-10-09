import type { Response } from "express";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { deliveryService } from "./delivery.service";
import type {
  CreateDeliveryZoneInput,
  DeliveryQuoteQuery,
  DeliveryZoneIdParam,
  UpdateDeliveryZoneInput,
} from "./delivery.validation";

const getZones = async (_req: ValidatedRequest, res: Response): Promise<void> => {
  const zones = await deliveryService.getZones();

  res.status(200).json({
    success: true,
    message: "Delivery zones fetched",
    data: zones,
  });
};

const getAllZones = async (_req: ValidatedRequest, res: Response): Promise<void> => {
  const zones = await deliveryService.getAllZones();

  res.status(200).json({
    success: true,
    message: "Delivery zones fetched",
    data: zones,
  });
};

const quote = async (
  req: ValidatedRequest<unknown, Record<string, string>, DeliveryQuoteQuery>,
  res: Response,
): Promise<void> => {
  const quoteResult = await deliveryService.quote(req.validatedQuery.city, req.validatedQuery.subtotal);

  res.status(200).json({
    success: true,
    message: "Delivery quote fetched",
    data: quoteResult,
  });
};

const createZone = async (
  req: ValidatedRequest<CreateDeliveryZoneInput>,
  res: Response,
): Promise<void> => {
  const zone = await deliveryService.createZone(req.validatedBody);

  res.status(201).json({
    success: true,
    message: "Delivery zone created",
    data: zone,
  });
};

const updateZone = async (
  req: ValidatedRequest<UpdateDeliveryZoneInput, DeliveryZoneIdParam>,
  res: Response,
): Promise<void> => {
  const zone = await deliveryService.updateZone(req.validatedParams.id, req.validatedBody);

  res.status(200).json({
    success: true,
    message: "Delivery zone updated",
    data: zone,
  });
};

const deleteZone = async (
  req: ValidatedRequest<unknown, DeliveryZoneIdParam>,
  res: Response,
): Promise<void> => {
  await deliveryService.deleteZone(req.validatedParams.id);

  res.status(200).json({
    success: true,
    message: "Delivery zone deleted",
  });
};

export const deliveryController = {
  getZones,
  getAllZones,
  quote,
  createZone,
  updateZone,
  deleteZone,
};
