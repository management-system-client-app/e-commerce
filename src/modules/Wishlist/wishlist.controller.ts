import type { Response } from "express";
import { AppError } from "../../app/errors/AppError";
import type { AuthContext } from "../../app/middlewares/auth";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { wishlistService } from "./wishlist.service";
import type { SaveWishlistInput, WishlistProductParam } from "./wishlist.validation";

const requireUser = (auth: AuthContext | undefined): string => {
  if (!auth || auth.role !== "USER") {
    throw AppError.forbidden("Only customers can use a wishlist");
  }

  return auth.id;
};

const getWishlist = async (req: ValidatedRequest, res: Response): Promise<void> => {
  const items = await wishlistService.getWishlist(requireUser(req.auth));

  res.status(200).json({
    success: true,
    message: "Wishlist fetched",
    data: items,
  });
};

const saveProduct = async (
  req: ValidatedRequest<SaveWishlistInput>,
  res: Response,
): Promise<void> => {
  const item = await wishlistService.saveProduct(requireUser(req.auth), req.validatedBody.productId);

  res.status(200).json({
    success: true,
    message: "Product saved",
    data: item,
  });
};

const removeProduct = async (
  req: ValidatedRequest<unknown, WishlistProductParam>,
  res: Response,
): Promise<void> => {
  await wishlistService.removeProduct(requireUser(req.auth), req.validatedParams.productId);

  res.status(200).json({
    success: true,
    message: "Product removed from wishlist",
  });
};

export const wishlistController = {
  getWishlist,
  saveProduct,
  removeProduct,
};
