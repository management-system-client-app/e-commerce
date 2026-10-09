import { Router } from "express";
import { authenticate, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { deliveryController } from "./delivery.controller";
import {
  createDeliveryZoneSchema,
  deliveryQuoteQuerySchema,
  deliveryZoneIdParamSchema,
  updateDeliveryZoneSchema,
} from "./delivery.validation";

const router = Router();

router.get(
  "/quote",
  validateRequest({ query: deliveryQuoteQuerySchema }),
  asyncHandler(deliveryController.quote),
);

router.get("/", asyncHandler(deliveryController.getZones));

router.get(
  "/manage",
  authenticate,
  authorize("ADMIN"),
  asyncHandler(deliveryController.getAllZones),
);

router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ body: createDeliveryZoneSchema }),
  asyncHandler(deliveryController.createZone),
);

router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateRequest({
    params: deliveryZoneIdParamSchema,
    body: updateDeliveryZoneSchema,
  }),
  asyncHandler(deliveryController.updateZone),
);

router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ params: deliveryZoneIdParamSchema }),
  asyncHandler(deliveryController.deleteZone),
);

export const deliveryRoutes = router;
