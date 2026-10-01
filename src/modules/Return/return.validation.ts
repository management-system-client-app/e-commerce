import { z } from "zod";

const returnTypes = ["RETURN", "EXCHANGE"] as const;
const returnReasons = [
  "WRONG_SIZE",
  "WRONG_ITEM",
  "DEFECTIVE",
  "NOT_AS_DESCRIBED",
  "CHANGED_MIND",
  "OTHER",
] as const;
const reviewDecisions = ["APPROVED", "REJECTED"] as const;

export const createReturnSchema = z
  .object({
    orderId: z.uuid(),
    type: z.enum(returnTypes),
    reason: z.enum(returnReasons),
    note: z.string().trim().min(1).max(500).optional(),
    items: z
      .array(
        z
          .object({
            orderItemId: z.uuid(),
            quantity: z.number().int().positive(),
            exchangeVariantId: z.uuid().optional(),
            conditionNote: z.string().trim().min(1).max(300).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict()
  .superRefine((value, ctx) => {
    const seen = new Set<string>();

    value.items.forEach((item, index) => {
      if (seen.has(item.orderItemId)) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "orderItemId"],
          message: "Each order item can only appear once",
        });
      }

      seen.add(item.orderItemId);

      if (value.type === "EXCHANGE" && !item.exchangeVariantId) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "exchangeVariantId"],
          message: "An exchange requires the variant the customer wants",
        });
      }

      if (value.type === "RETURN" && item.exchangeVariantId) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "exchangeVariantId"],
          message: "exchangeVariantId is only allowed for an exchange",
        });
      }
    });
  });

export const reviewReturnSchema = z
  .object({
    decision: z.enum(reviewDecisions),
    adminNote: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const returnIdParamSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export const returnListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z
      .enum([
        "REQUESTED",
        "APPROVED",
        "REJECTED",
        "IN_TRANSIT",
        "RECEIVED",
        "REFUNDED",
        "EXCHANGED",
        "CLOSED",
      ])
      .optional(),
  })
  .strict();

export type CreateReturnInput = z.infer<typeof createReturnSchema>;
export type ReviewReturnInput = z.infer<typeof reviewReturnSchema>;
export type ReturnIdParam = z.infer<typeof returnIdParamSchema>;
export type ReturnListQuery = z.infer<typeof returnListQuerySchema>;
