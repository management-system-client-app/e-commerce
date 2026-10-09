import type { Response } from "express";
import { AppError } from "../../app/errors/AppError";
import type { AuthContext } from "../../app/middlewares/auth";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { readCartSessionId } from "../Cart/cart.session";
import { paymentService } from "../Payment/payment.service";
import { orderService } from "./order.service";
import type {
  OrderIdParam,
  OrderListQuery,
  PlaceOrderInput,
  TrackOrderQuery,
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
  if (req.auth?.role === "ADMIN") {
    throw AppError.forbidden("Only customers can place orders");
  }

  const buyer =
    req.auth?.role === "USER"
      ? { kind: "user" as const, userId: req.auth.id }
      : { kind: "guest" as const, sessionId: readCartSessionId(req) ?? "" };

  if (buyer.kind === "guest" && !buyer.sessionId) {
    throw AppError.badRequest("Your cart is empty");
  }

  const { order, paymentMethod, payTo, emailed } = await orderService.placeOrder(buyer, req.validatedBody);

  if (paymentMethod === "COD") {
    res.status(201).json({
      success: true,
      message: "Order placed. Pay cash on delivery.",
      data: {
        ...order,
        paymentMethod: "COD",
        checkoutUrl: null,
        payTo: null,
        emailed,
      },
    });
    return;
  }

  if (paymentMethod === "BKASH" || paymentMethod === "NAGAD" || paymentMethod === "ROCKET") {
    res.status(201).json({
      success: true,
      message: "Order placed. Send the total, then submit the transaction id.",
      data: {
        ...order,
        paymentMethod,
        checkoutUrl: null,
        payTo,
        emailed,
      },
    });
    return;
  }

  try {
    const checkout = await paymentService.createCheckoutSession(
      buyer.kind === "user" ? buyer.userId : null,
      order.id,
    );

    res.status(201).json({
      success: true,
      message: "Order placed. Open checkoutUrl to pay.",
      data: {
        ...order,
        paymentMethod: "STRIPE",
        checkoutUrl: checkout.url,
        payTo: null,
        emailed,
      },
    });
  } catch (error) {
    await orderService.cancelUnpaidOrder(order.id, "Payment page could not be created");
    throw error;
  }
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

const trackOrder = async (
  req: ValidatedRequest<unknown, Record<string, string>, TrackOrderQuery>,
  res: Response,
): Promise<void> => {
  const order = await orderService.trackOrder(req.validatedQuery);

  res.status(200).json({
    success: true,
    message: "Order tracked",
    data: order,
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
  trackOrder,
  getOrder,
  updateOrderStatus,
};
