import type { Response } from "express";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { dashboardService } from "./dashboard.service";

const getOverview = async (_req: ValidatedRequest, res: Response): Promise<void> => {
  const overview = await dashboardService.getOverview();

  res.status(200).json({
    success: true,
    message: "Dashboard fetched",
    data: overview,
  });
};

export const dashboardController = {
  getOverview,
};
