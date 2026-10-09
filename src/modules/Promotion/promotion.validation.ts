import { z } from "zod";

const discountTypes = ["PERCENTAGE", "FIXED_AMOUNT"] as const;
const promotionScopes = ["ORDER", "PRODUCT", "CATEGORY", "BRAND"] as const;

const moneySchema = z
  .number()
  .positive()
  .max(99_999_999.99)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
    message: "Amount can have at most 2 decimal places",
  });

const idList = z.array(z.uuid()).max(100).optional();

const promotionFields = {
  name: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase and hyphenated")
    .optional(),
  description: z.string().trim().min(1).max(1000).nullable().optional(),
  type: z.enum(discountTypes),
  value: moneySchema,
  scope: z.enum(promotionScopes).optional(),
  minOrderAmount: moneySchema.nullable().optional(),
  maxDiscount: moneySchema.nullable().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
  productIds: idList,
  categoryIds: idList,
  brandIds: idList,
};

const scheduleAndScope = (
  value: {
    type?: "PERCENTAGE" | "FIXED_AMOUNT";
    value?: number;
    startsAt?: Date;
    endsAt?: Date;
    scope?: (typeof promotionScopes)[number];
    productIds?: string[];
    categoryIds?: string[];
    brandIds?: string[];
  },
  ctx: z.RefinementCtx,
  creating: boolean,
): void => {
  if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) {
    ctx.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "endsAt must be after startsAt",
    });
  }

  if (value.type === "PERCENTAGE" && value.value != null && value.value > 100) {
    ctx.addIssue({
      code: "custom",
      path: ["value"],
      message: "Percentage discount cannot exceed 100",
    });
  }

  if (!creating) {
    return;
  }

  const scope = value.scope ?? "ORDER";

  if (scope === "PRODUCT" && (value.productIds?.length ?? 0) === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["productIds"],
      message: "A product promotion needs at least one product",
    });
  }

  if (scope === "CATEGORY" && (value.categoryIds?.length ?? 0) === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["categoryIds"],
      message: "A category promotion needs at least one category",
    });
  }

  if (scope === "BRAND" && (value.brandIds?.length ?? 0) === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["brandIds"],
      message: "A brand promotion needs at least one brand",
    });
  }
};

export const createPromotionSchema = z
  .object(promotionFields)
  .strict()
  .superRefine((value, ctx) => scheduleAndScope(value, ctx, true));

export const updatePromotionSchema = z
  .object({
    ...promotionFields,
    name: promotionFields.name.optional(),
    type: promotionFields.type.optional(),
    value: promotionFields.value.optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  })
  .superRefine((value, ctx) => scheduleAndScope(value, ctx, false));

export const promotionIdParamSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export const promotionListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .strict();

export const quotePromotionSchema = z
  .object({
    couponCode: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .transform((value) => value.toUpperCase())
      .refine((value) => /^[A-Z0-9_-]+$/.test(value), {
        message: "Code can contain only letters, numbers, underscores, and hyphens",
      })
      .optional(),
  })
  .strict();

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;
export type PromotionIdParam = z.infer<typeof promotionIdParamSchema>;
export type PromotionListQuery = z.infer<typeof promotionListQuerySchema>;
export type QuotePromotionInput = z.infer<typeof quotePromotionSchema>;
