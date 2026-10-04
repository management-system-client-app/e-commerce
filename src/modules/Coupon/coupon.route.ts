import { Router } from "express";
import { authenticate, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { couponController } from "./coupon.controller";
import {
  applyCouponSchema,
  couponIdParamSchema,
  couponListQuerySchema,
  createCouponSchema,
  updateCouponSchema,
} from "./coupon.validation";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ body: createCouponSchema }),
  asyncHandler(couponController.createCoupon),
);

router.get(
  "/",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ query: couponListQuerySchema }),
  asyncHandler(couponController.getCoupons),
);

router.post(
  "/apply",
  authenticate,
  authorize("USER"),
  validateRequest({ body: applyCouponSchema }),
  asyncHandler(couponController.applyCoupon),
);

router.get(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ params: couponIdParamSchema }),
  asyncHandler(couponController.getCoupon),
);

router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateRequest({
    params: couponIdParamSchema,
    body: updateCouponSchema,
  }),
  asyncHandler(couponController.updateCoupon),
);

router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ params: couponIdParamSchema }),
  asyncHandler(couponController.deleteCoupon),
);

export const couponRoutes = router;
