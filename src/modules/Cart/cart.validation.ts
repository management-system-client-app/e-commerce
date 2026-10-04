import { z } from "zod";

export const addCartItemSchema = z
  .object({
    variantId: z.uuid(),
    quantity: z.number().int().positive().max(99),
  })
  .strict();

export const cartItemParamSchema = z
  .object({
    itemId: z.uuid(),
  })
  .strict();

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type CartItemParam = z.infer<typeof cartItemParamSchema>;
