import type { Response } from "express";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { uploadImageBuffer } from "../../app/config/cloudinary";
import { AppError } from "../../app/errors/AppError";
import { settingsService } from "./settings.service";
import type { CollageImageSlot, UpdateSettingsInput } from "./settings.validation";

const getSettings = async (_req: ValidatedRequest, res: Response): Promise<void> => {
  const settings = await settingsService.getSettings();

  res.status(200).json({
    success: true,
    message: "Settings fetched",
    data: settings,
  });
};

const updateSettings = async (
  req: ValidatedRequest<UpdateSettingsInput>,
  res: Response,
): Promise<void> => {
  const settings = await settingsService.updateSettings(req.validatedBody);

  res.status(200).json({
    success: true,
    message: "Settings saved",
    data: settings,
  });
};

const collageImageFields: Record<CollageImageSlot, keyof UpdateSettingsInput> = {
  man: "collageManImageUrl",
  woman: "collageWomanImageUrl",
  child: "collageChildImageUrl",
  accessories: "collageAccessoriesImageUrl",
};

const uploadCollageImage = async (
  req: ValidatedRequest<{ imageUrl: string }, { slot: CollageImageSlot }>,
  res: Response,
): Promise<void> => {
  const field = collageImageFields[req.validatedParams.slot];
  const settings = await settingsService.updateSettings({ [field]: req.validatedBody.imageUrl });

  res.status(200).json({
    success: true,
    message: "Collage image saved",
    data: { slot: req.validatedParams.slot, imageUrl: settings[field] },
  });
};

export const settingsController = {
  getSettings,
  updateSettings,
  uploadCollageImage,
};
