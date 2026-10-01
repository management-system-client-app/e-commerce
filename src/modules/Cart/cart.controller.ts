import type { Response } from "express";
import { AppError } from "../../app/errors/AppError";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { cartService } from "./cart.service";
import type { AddCartItemInput, CartItemParam } from "./cart.validation";

const requireUserId = (auth: { id: string; role: string } | undefined): string => {
  if (!auth || auth.role !== "USER") {
    throw AppError.unauthorized();
  }

  return auth.id;
};

const getCart = async (req: ValidatedRequest, res: Response): Promise<void> => {
  const cart = await cartService.getCart(requireUserId(req.auth));

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
  const cart = await cartService.addItem(requireUserId(req.auth), req.validatedBody);

  res.status(200).json({
    success: true,
    message: "Item added to cart",
    data: cart,
  });
};

const removeItem = async (
  req: ValidatedRequest<unknown, CartItemParam>,
  res: Response,
): Promise<void> => {
  const cart = await cartService.removeItem(
    requireUserId(req.auth),
    req.validatedParams.itemId,
  );

  res.status(200).json({
    success: true,
    message: "Item removed from cart",
    data: cart,
  });
};

export const cartController = {
  getCart,
  addItem,
  removeItem,
};
