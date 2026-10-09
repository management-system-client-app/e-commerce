import type { Response } from "express";
import { AppError } from "../../app/errors/AppError";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { userService } from "./user.service";
import type { RegisterUserInput, SaveAddressInput, UpdateProfileInput, UserIdParam } from "./user.validation";

const register = async (
  req: ValidatedRequest<RegisterUserInput>,
  res: Response,
): Promise<void> => {
  const user = await userService.createUser(req.validatedBody);

  res.status(201).json({
    success: true,
    message: "Account created",
    data: user,
  });
};

const getMe = async (req: ValidatedRequest, res: Response): Promise<void> => {
  if (!req.auth) {
    throw AppError.unauthorized();
  }

  const account = await userService.getCurrentAccount(req.auth);

  res.status(200).json({
    success: true,
    message: "Account fetched",
    data: account,
  });
};

const updateMe = async (
  req: ValidatedRequest<UpdateProfileInput>,
  res: Response,
): Promise<void> => {
  if (!req.auth) {
    throw AppError.unauthorized();
  }

  const account = await userService.updateProfile(req.auth, req.validatedBody);

  res.status(200).json({
    success: true,
    message: "Profile updated",
    data: account,
  });
};

const getDefaultAddress = async (req: ValidatedRequest, res: Response): Promise<void> => {
  if (!req.auth || req.auth.role !== "USER") {
    throw AppError.unauthorized();
  }

  const address = await userService.getDefaultAddress(req.auth.id);
  res.status(200).json({ success: true, message: "Address fetched", data: address });
};

const saveDefaultAddress = async (
  req: ValidatedRequest<SaveAddressInput>,
  res: Response,
): Promise<void> => {
  if (!req.auth || req.auth.role !== "USER") {
    throw AppError.unauthorized();
  }

  const address = await userService.saveDefaultAddress(req.auth.id, req.validatedBody);
  res.status(200).json({ success: true, message: "Address saved", data: address });
};

const getUser = async (
  req: ValidatedRequest<unknown, UserIdParam>,
  res: Response,
): Promise<void> => {
  const user = await userService.getUserById(req.validatedParams.id);

  res.status(200).json({
    success: true,
    message: "User fetched",
    data: user,
  });
};

export const userController = {
  register,
  getMe,
  updateMe,
  getDefaultAddress,
  saveDefaultAddress,
  getUser,
};
