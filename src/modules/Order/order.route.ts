import { Router } from "express";
import { authenticate, authenticateOptional, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { orderTrackRateLimiter } from "../../app/middlewares/rateLimiter";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { orderController } from "./order.controller";
import {
  orderIdParamSchema,
  orderListQuerySchema,
  placeOrderSchema,
  trackOrderQuerySchema,
  updateOrderStatusSchema,
} from "./order.validation";

const router = Router();

router.post(
  "/",
  authenticateOptional,
  validateRequest({ body: placeOrderSchema }),
  asyncHandler(orderController.placeOrder),
);

router.get(
  "/",
  authenticate,
  authorize("USER", "ADMIN"),
  validateRequest({ query: orderListQuerySchema }),
  asyncHandler(orderController.getOrders),
);

router.get(
  "/track",
  orderTrackRateLimiter,
  validateRequest({ query: trackOrderQuerySchema }),
  asyncHandler(orderController.trackOrder),
);

router.patch(
  "/:id/status",
  authenticate,
  authorize("ADMIN"),
  validateRequest({
    params: orderIdParamSchema,
    body: updateOrderStatusSchema,
  }),
  asyncHandler(orderController.updateOrderStatus),
);

router.get(
  "/:id",
  authenticate,
  authorize("USER", "ADMIN"),
  validateRequest({ params: orderIdParamSchema }),
  asyncHandler(orderController.getOrder),
);

export const orderRoutes = router;
