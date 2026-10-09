import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { authenticate, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { applyUploadedImage, parseMultipartData, singleImageUpload } from "../../app/middlewares/upload";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { userController } from "./user.controller";
import { registerUserSchema, saveAddressSchema, updateProfileSchema, userIdParamSchema } from "./user.validation";

const router = Router();

const avatarFromUpload = (req: Request, _res: Response, next: NextFunction): void => {
  const body = req.body as { imageUrl?: string } | undefined;
  if (body?.imageUrl) {
    req.body = { ...body, avatarUrl: body.imageUrl };
    delete (req.body as { imageUrl?: string }).imageUrl;
  }
  next();
};

router.post(
  "/register",
  validateRequest({ body: registerUserSchema }),
  asyncHandler(userController.register),
);

router.get(
  "/me",
  authenticate,
  authorize("USER", "ADMIN"),
  asyncHandler(userController.getMe),
);

router.patch(
  "/me",
  authenticate,
  authorize("USER", "ADMIN"),
  singleImageUpload,
  parseMultipartData,
  applyUploadedImage("ecommerce/avatars"),
  avatarFromUpload,
  validateRequest({ body: updateProfileSchema }),
  asyncHandler(userController.updateMe),
);

router.get(
  "/me/address",
  authenticate,
  authorize("USER"),
  asyncHandler(userController.getDefaultAddress),
);

router.put(
  "/me/address",
  authenticate,
  authorize("USER"),
  validateRequest({ body: saveAddressSchema }),
  asyncHandler(userController.saveDefaultAddress),
);

router.get(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ params: userIdParamSchema }),
  asyncHandler(userController.getUser),
);

export const userRoutes = router;
