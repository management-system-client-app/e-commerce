import { Router } from "express";
import { authenticate, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { brandRoutes } from "../Brand/brand.route";
import { categoryRoutes } from "../Category/category.route";
import { catalogController } from "./catalog.controller";
import {
  catalogListQuerySchema,
  createFabricSchema,
  createSizeSchema,
} from "./catalog.validation";

const router = Router();
const admin = [authenticate, authorize("ADMIN")] as const;

router.get("/", asyncHandler(catalogController.getCatalog));

router.use("/brands", brandRoutes);
router.use("/categories", categoryRoutes);

router.post(
  "/sizes",
  ...admin,
  validateRequest({ body: createSizeSchema }),
  asyncHandler(catalogController.createSize),
);

router.get(
  "/sizes",
  validateRequest({ query: catalogListQuerySchema }),
  asyncHandler(catalogController.getSizes),
);

router.post(
  "/fabrics",
  ...admin,
  validateRequest({ body: createFabricSchema }),
  asyncHandler(catalogController.createFabric),
);

router.get(
  "/fabrics",
  validateRequest({ query: catalogListQuerySchema }),
  asyncHandler(catalogController.getFabrics),
);

export const catalogRoutes = router;
