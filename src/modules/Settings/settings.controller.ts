import type { Response } from "express";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { settingsService } from "./settings.service";
import type { UpdateSettingsInput } from "./settings.validation";

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

export const settingsController = {
  getSettings,
  updateSettings,
};
