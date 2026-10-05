import { Router } from "express";
import { authenticate, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { categoryController } from "./category.controller";
import { categoryListQuerySchema, createCategorySchema } from "./category.validation";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ body: createCategorySchema }),
  asyncHandler(categoryController.createCategory),
);

router.get(
  "/",
  validateRequest({ query: categoryListQuerySchema }),
  asyncHandler(categoryController.getCategories),
);

export const categoryRoutes = router;
