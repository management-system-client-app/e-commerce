import { Router } from "express";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { variantController } from "./variant.controller";
import {
  createVariantSchema,
  updateVariantSchema,
  variantIdParamSchema,
  variantListQuerySchema,
} from "./variant.validation";

const router = Router();

router.post(
  "/",
  validateRequest({ body: createVariantSchema }),
  asyncHandler(variantController.createVariant),
);

router.get(
  "/",
  validateRequest({ query: variantListQuerySchema }),
  asyncHandler(variantController.getAllVariants),
);

router.get(
  "/:id",
  validateRequest({ params: variantIdParamSchema }),
  asyncHandler(variantController.getSingleVariant),
);

router.patch(
  "/:id",
  validateRequest({
    params: variantIdParamSchema,
    body: updateVariantSchema,
  }),
  asyncHandler(variantController.updateVariant),
);

router.delete(
  "/:id",
  validateRequest({ params: variantIdParamSchema }),
  asyncHandler(variantController.deleteVariant),
);

export const variantRoutes = router;
