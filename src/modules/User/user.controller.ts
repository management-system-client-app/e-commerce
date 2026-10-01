import type { Response } from "express";
import { AppError } from "../../app/errors/AppError";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { userService } from "./user.service";
import type { RegisterUserInput, UserIdParam } from "./user.validation";

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
  getUser,
};
