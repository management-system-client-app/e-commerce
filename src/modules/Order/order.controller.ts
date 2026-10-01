import type { Response } from "express";
import { AppError } from "../../app/errors/AppError";
import type { AuthContext } from "../../app/middlewares/auth";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { orderService } from "./order.service";
import type {
  OrderIdParam,
  OrderListQuery,
  PlaceOrderInput,
  UpdateOrderStatusInput,
} from "./order.validation";

const requireAuth = (auth: AuthContext | undefined): AuthContext => {
  if (!auth) {
    throw AppError.unauthorized();
  }

  return auth;
};

const placeOrder = async (
  req: ValidatedRequest<PlaceOrderInput>,
  res: Response,
): Promise<void> => {
  const auth = requireAuth(req.auth);

  if (auth.role !== "USER") {
    throw AppError.forbidden("Only customers can place orders");
  }

  const order = await orderService.placeOrder(auth.id, req.validatedBody);

  res.status(201).json({
    success: true,
    message: "Order placed",
    data: order,
  });
};

const getOrders = async (
  req: ValidatedRequest<unknown, Record<string, string>, OrderListQuery>,
  res: Response,
): Promise<void> => {
  const result = await orderService.getOrders(requireAuth(req.auth), req.validatedQuery);

  res.status(200).json({
    success: true,
    message: "Orders fetched",
    data: result.items,
    meta: result.meta,
  });
};

const getOrder = async (
  req: ValidatedRequest<unknown, OrderIdParam>,
  res: Response,
): Promise<void> => {
  const order = await orderService.getOrder(requireAuth(req.auth), req.validatedParams.id);

  res.status(200).json({
    success: true,
    message: "Order fetched",
    data: order,
  });
};

const updateOrderStatus = async (
  req: ValidatedRequest<UpdateOrderStatusInput, OrderIdParam>,
  res: Response,
): Promise<void> => {
  const order = await orderService.updateOrderStatus(
    req.validatedParams.id,
    req.validatedBody,
  );

  res.status(200).json({
    success: true,
    message: "Order status updated",
    data: order,
  });
};

export const orderController = {
  placeOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
};
