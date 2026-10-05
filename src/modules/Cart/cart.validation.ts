import { z } from "zod";

export const addCartItemSchema = z
  .object({
    variantId: z.uuid().optional(),
    productId: z.uuid().optional(),
    quantity: z.number().int().positive().max(99),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.variantId && !value.productId) {
      ctx.addIssue({
        code: "custom",
        message: "Send productId or variantId",
      });
    }

    if (value.variantId && value.productId) {
      ctx.addIssue({
        code: "custom",
        message: "Send productId or variantId, not both",
      });
    }
  });

export const cartItemParamSchema = z
  .object({
    itemId: z.uuid(),
  })
  .strict();

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type CartItemParam = z.infer<typeof cartItemParamSchema>;
