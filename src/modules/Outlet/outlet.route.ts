import { Router } from "express";
import { authenticate, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { outletController } from "./outlet.controller";
import {
  createOutletSchema,
  outletIdParamSchema,
  updateOutletSchema,
} from "./outlet.validation";

const router = Router();

router.get("/", asyncHandler(outletController.getOutlets));

router.get(
  "/manage",
  authenticate,
  authorize("ADMIN"),
  asyncHandler(outletController.getAllOutlets),
);

router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ body: createOutletSchema }),
  asyncHandler(outletController.createOutlet),
);

router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateRequest({
    params: outletIdParamSchema,
    body: updateOutletSchema,
  }),
  asyncHandler(outletController.updateOutlet),
);

router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ params: outletIdParamSchema }),
  asyncHandler(outletController.deleteOutlet),
);

export const outletRoutes = router;
