import { randomUUID } from "node:crypto";
import type { Response } from "express";
import { AppError } from "../../app/errors/AppError";
import { NotFoundError } from "../../app/errors/NotFoundError";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import {
  clearCartSessionCookie,
  readCartSessionId,
  setCartSessionCookie,
} from "./cart.session";
import { cartService, type CartOwner } from "./cart.service";
import type { AddCartItemInput, CartItemParam, CartPaymentInput } from "./cart.validation";

const prepareOwner = async (
  req: ValidatedRequest,
  res: Response,
): Promise<{ kind: "user"; userId: string } | { kind: "guest"; sessionId: string | null }> => {
  if (req.auth?.role === "ADMIN") {
    throw AppError.forbidden("You do not have permission to perform this action");
  }

  const sessionId = readCartSessionId(req);

  if (req.auth?.role === "USER") {
    if (sessionId) {
      await cartService.mergeGuestCart(req.auth.id, sessionId);
    }

    clearCartSessionCookie(res);
    return { kind: "user", userId: req.auth.id };
  }

  return { kind: "guest", sessionId };
};

const requireOwner = (
  owner: { kind: "user"; userId: string } | { kind: "guest"; sessionId: string | null },
): CartOwner => {
  if (owner.kind === "user") {
    return owner;
  }

  if (!owner.sessionId) {
    throw new NotFoundError("Cart item not found");
  }

  return { kind: "guest", sessionId: owner.sessionId };
};

const getCart = async (req: ValidatedRequest, res: Response): Promise<void> => {
  const owner = await prepareOwner(req, res);

  if (owner.kind === "guest" && !owner.sessionId) {
    res.status(200).json({
      success: true,
      message: "Cart fetched",
      data: cartService.emptyCart(),
    });
    return;
  }

  const cartOwner = requireOwner(owner);

  if (cartOwner.kind === "guest") {
    setCartSessionCookie(res, cartOwner.sessionId);
  }

  const cart = await cartService.getCart(cartOwner);

  res.status(200).json({
    success: true,
    message: "Cart fetched",
    data: cart,
  });
};

const addItem = async (
  req: ValidatedRequest<AddCartItemInput>,
  res: Response,
): Promise<void> => {
  const owner = await prepareOwner(req, res);
  const cartOwner: CartOwner =
    owner.kind === "user"
      ? owner
      : { kind: "guest", sessionId: owner.sessionId ?? randomUUID() };
  const cart = await cartService.addItem(cartOwner, req.validatedBody);
  const sessionId = cartOwner.kind === "guest" ? cartOwner.sessionId : null;

  if (sessionId) {
    setCartSessionCookie(res, sessionId);
  }

  res.status(200).json({
    success: true,
    message: "Item added to cart",
    data: cart,
  });
};

const choosePayment = async (
  req: ValidatedRequest<CartPaymentInput>,
  res: Response,
): Promise<void> => {
  const owner = await prepareOwner(req, res);
  const cartOwner = requireOwner(owner);

  if (cartOwner.kind === "guest") {
    setCartSessionCookie(res, cartOwner.sessionId);
  }

  const cart = await cartService.choosePayment(cartOwner, req.validatedBody);

  res.status(200).json({
    success: true,
    message: "Payment method saved",
    data: cart,
  });
};

const removeItem = async (
  req: ValidatedRequest<unknown, CartItemParam>,
  res: Response,
): Promise<void> => {
  const owner = await prepareOwner(req, res);
  const cartOwner = requireOwner(owner);

  if (cartOwner.kind === "guest") {
    setCartSessionCookie(res, cartOwner.sessionId);
  }

  const cart = await cartService.removeItem(cartOwner, req.validatedParams.itemId);

  res.status(200).json({
    success: true,
    message: "Item removed from cart",
    data: cart,
  });
};

export const cartController = {
  getCart,
  addItem,
  choosePayment,
  removeItem,
};
