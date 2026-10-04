import type { Response } from "express";
import { AppError } from "../../app/errors/AppError";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { couponService } from "./coupon.service";
import type {
  ApplyCouponInput,
  CouponIdParam,
  CouponListQuery,
  CreateCouponInput,
  UpdateCouponInput,
} from "./coupon.validation";

const createCoupon = async (
  req: ValidatedRequest<CreateCouponInput>,
  res: Response,
): Promise<void> => {
  const coupon = await couponService.createCoupon(req.validatedBody);

  res.status(201).json({
    success: true,
    message: "Coupon created",
    data: coupon,
  });
};

const getCoupons = async (
  req: ValidatedRequest<unknown, Record<string, string>, CouponListQuery>,
  res: Response,
): Promise<void> => {
  const result = await couponService.getCoupons(req.validatedQuery);

  res.status(200).json({
    success: true,
    message: "Coupons fetched",
    data: result.items,
    meta: result.meta,
  });
};

const getCoupon = async (
  req: ValidatedRequest<unknown, CouponIdParam>,
  res: Response,
): Promise<void> => {
  const coupon = await couponService.getCoupon(req.validatedParams.id);

  res.status(200).json({
    success: true,
    message: "Coupon fetched",
    data: coupon,
  });
};

const updateCoupon = async (
  req: ValidatedRequest<UpdateCouponInput, CouponIdParam>,
  res: Response,
): Promise<void> => {
  const coupon = await couponService.updateCoupon(req.validatedParams.id, req.validatedBody);

  res.status(200).json({
    success: true,
    message: "Coupon updated",
    data: coupon,
  });
};

const deleteCoupon = async (
  req: ValidatedRequest<unknown, CouponIdParam>,
  res: Response,
): Promise<void> => {
  await couponService.deleteCoupon(req.validatedParams.id);

  res.status(200).json({
    success: true,
    message: "Coupon deleted",
  });
};

const applyCoupon = async (
  req: ValidatedRequest<ApplyCouponInput>,
  res: Response,
): Promise<void> => {
  if (!req.auth || req.auth.role !== "USER") {
    throw AppError.forbidden("Only customers can apply a coupon");
  }

  const result = await couponService.applyCoupon(req.auth.id, req.validatedBody);

  res.status(200).json({
    success: true,
    message: "Coupon applied",
    data: result,
  });
};

export const couponController = {
  createCoupon,
  getCoupons,
  getCoupon,
  updateCoupon,
  deleteCoupon,
  applyCoupon,
};
