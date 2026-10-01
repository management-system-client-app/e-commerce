import { Router } from "express";
import { authenticate, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { orderController } from "./order.controller";
import {
  orderIdParamSchema,
  orderListQuerySchema,
  placeOrderSchema,
  updateOrderStatusSchema,
} from "./order.validation";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize("USER"),
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
