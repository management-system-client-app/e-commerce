import type { Response } from "express";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { authService } from "./auth.service";
import type { LoginInput } from "./auth.validation";

const login = async (
  req: ValidatedRequest<LoginInput>,
  res: Response,
): Promise<void> => {
  const result = await authService.login(req.validatedBody);

  res.status(200).json({
    success: true,
    message: "Logged in",
    data: result,
  });
};

const loginAdmin = async (
  req: ValidatedRequest<LoginInput>,
  res: Response,
): Promise<void> => {
  const result = await authService.loginAdmin(req.validatedBody);

  res.status(200).json({
    success: true,
    message: "Logged in",
    data: result,
  });
};

export const authController = {
  login,
  loginAdmin,
};
