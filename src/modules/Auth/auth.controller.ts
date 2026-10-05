import type { Response } from "express";
import { AppError } from "../../app/errors/AppError";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { cartService } from "../Cart/cart.service";
import { clearCartSessionCookie, readCartSessionId } from "../Cart/cart.session";
import { authService } from "./auth.service";
import type { LoginInput } from "./auth.validation";

const login = async (
  req: ValidatedRequest<LoginInput>,
  res: Response,
): Promise<void> => {
  const result = await authService.login(req.validatedBody);
  const sessionId = readCartSessionId(req);

  if (sessionId) {
    await cartService.mergeGuestCart(result.user.id, sessionId);
    clearCartSessionCookie(res);
  }

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

const logout = async (req: ValidatedRequest, res: Response): Promise<void> => {
  if (!req.auth) {
    throw AppError.unauthorized();
  }

  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";

  if (!token) {
    throw AppError.unauthorized("Access token is required");
  }

  await authService.logout(req.auth, token);

  res.status(200).json({
    success: true,
    message: "Logged out",
  });
};

export const authController = {
  login,
  loginAdmin,
  logout,
};
