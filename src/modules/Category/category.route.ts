import { Router } from "express";
import { authenticate, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { applyUploadedImage, parseMultipartData, singleImageUpload } from "../../app/middlewares/upload";
import { categoryController } from "./category.controller";
import {
  categoryIdParamSchema,
  categoryListQuerySchema,
  createCategorySchema,
  updateCategorySchema,
} from "./category.validation";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  singleImageUpload,
  parseMultipartData,
  applyUploadedImage("ecommerce/categories"),
  validateRequest({ body: createCategorySchema }),
  asyncHandler(categoryController.createCategory),
);

router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  singleImageUpload,
  parseMultipartData,
  applyUploadedImage("ecommerce/categories"),
  validateRequest({ params: categoryIdParamSchema, body: updateCategorySchema }),
  asyncHandler(categoryController.updateCategory),
);

router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ params: categoryIdParamSchema }),
  asyncHandler(categoryController.deleteCategory),
);

router.get(
  "/",
  validateRequest({ query: categoryListQuerySchema }),
  asyncHandler(categoryController.getCategories),
);

export const categoryRoutes = router;
