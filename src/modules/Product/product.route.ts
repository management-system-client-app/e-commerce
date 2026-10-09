import { Router } from "express";
import { authenticate, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { parseMultipartData, productImagesUpload } from "../../app/middlewares/upload";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { productController } from "./product.controller";
import {
  createProductSchema,
  productIdParamSchema,
  productListQuerySchema,
  updateProductSchema,
} from "./product.validation";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  productImagesUpload,
  parseMultipartData,
  validateRequest({ body: createProductSchema }),
  asyncHandler(productController.createProduct),
);

router.get(
  "/",
  validateRequest({ query: productListQuerySchema }),
  asyncHandler(productController.getAllProducts),
);

router.get("/best-sellers", asyncHandler(productController.getBestSellers));

router.get(
  "/:id/related",
  validateRequest({ params: productIdParamSchema }),
  asyncHandler(productController.getRelatedProducts),
);

router.get(
  "/:id",
  validateRequest({ params: productIdParamSchema }),
  asyncHandler(productController.getSingleProduct),
);

router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  productImagesUpload,
  parseMultipartData,
  validateRequest({
    params: productIdParamSchema,
    body: updateProductSchema,
  }),
  asyncHandler(productController.updateProduct),
);

router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ params: productIdParamSchema }),
  asyncHandler(productController.deleteProduct),
);

export const productRoutes = router;
