import { z } from "zod";

export const saveWishlistSchema = z
  .object({
    productId: z.uuid(),
  })
  .strict();

export const wishlistProductParamSchema = z
  .object({
    productId: z.uuid(),
  })
  .strict();

export type SaveWishlistInput = z.infer<typeof saveWishlistSchema>;
export type WishlistProductParam = z.infer<typeof wishlistProductParamSchema>;
