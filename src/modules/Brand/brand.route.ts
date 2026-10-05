import { Router } from "express";
import { authenticate, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { brandController } from "./brand.controller";
import { brandListQuerySchema, createBrandSchema } from "./brand.validation";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ body: createBrandSchema }),
  asyncHandler(brandController.createBrand),
);

router.get(
  "/",
  validateRequest({ query: brandListQuerySchema }),
  asyncHandler(brandController.getBrands),
);

export const brandRoutes = router;
