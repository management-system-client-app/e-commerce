import { Router } from "express";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
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
  validateRequest({ body: createProductSchema }),
  asyncHandler(productController.createProduct),
);

router.get(
  "/",
  validateRequest({ query: productListQuerySchema }),
  asyncHandler(productController.getAllProducts),
);

router.get(
  "/:id",
  validateRequest({ params: productIdParamSchema }),
  asyncHandler(productController.getSingleProduct),
);

router.patch(
  "/:id",
  validateRequest({
    params: productIdParamSchema,
    body: updateProductSchema,
  }),
  asyncHandler(productController.updateProduct),
);

router.delete(
  "/:id",
  validateRequest({ params: productIdParamSchema }),
  asyncHandler(productController.deleteProduct),
);

export const productRoutes = router;
