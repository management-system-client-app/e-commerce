import { Router } from "express";
import { authenticate, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { userController } from "./user.controller";
import { registerUserSchema, updateProfileSchema, userIdParamSchema } from "./user.validation";

const router = Router();

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
  validateRequest({ body: updateProfileSchema }),
  asyncHandler(userController.updateMe),
);

router.get(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ params: userIdParamSchema }),
  asyncHandler(userController.getUser),
);

export const userRoutes = router;
