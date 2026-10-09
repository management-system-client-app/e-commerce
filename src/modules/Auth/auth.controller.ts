import type { Response } from "express";
import { AppError } from "../../app/errors/AppError";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { cartService } from "../Cart/cart.service";
import { clearCartSessionCookie, readCartSessionId } from "../Cart/cart.session";
import { authService } from "./auth.service";
import type { ForgotPasswordInput, LoginInput, ResetPasswordInput, VerifyResetCodeInput } from "./auth.validation";

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

const forgotPassword = async (
  req: ValidatedRequest<ForgotPasswordInput>,
  res: Response,
): Promise<void> => {
  const result = await authService.forgotPassword(req.validatedBody);

  res.status(200).json({
    success: true,
    message: "If an account exists for that email, a reset code has been sent",
    ...(result.code ? { data: { code: result.code } } : {}),
  });
};

const forgotAdminPassword = async (
  req: ValidatedRequest<ForgotPasswordInput>,
  res: Response,
): Promise<void> => {
  const result = await authService.forgotAdminPassword(req.validatedBody);

  res.status(200).json({
    success: true,
    message: "If an account exists for that email, a reset code has been sent",
    ...(result.code ? { data: { code: result.code } } : {}),
  });
};

const verifyResetCode = async (
  req: ValidatedRequest<VerifyResetCodeInput>,
  res: Response,
): Promise<void> => {
  await authService.verifyResetCode(req.validatedBody);

  res.status(200).json({
    success: true,
    message: "Code accepted",
  });
};

const resetPassword = async (
  req: ValidatedRequest<ResetPasswordInput>,
  res: Response,
): Promise<void> => {
  await authService.resetPassword(req.validatedBody);

  res.status(200).json({
    success: true,
    message: "Password updated",
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
  forgotPassword,
  forgotAdminPassword,
  verifyResetCode,
  resetPassword,
};
