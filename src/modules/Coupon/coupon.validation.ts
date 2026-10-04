import { z } from "zod";

const discountTypes = ["PERCENTAGE", "FIXED_AMOUNT"] as const;

const couponCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z0-9_-]+$/.test(value), {
    message: "Code can contain only letters, numbers, underscores, and hyphens",
  });

const moneySchema = z
  .number()
  .positive()
  .max(99_999_999.99)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
    message: "Amount can have at most 2 decimal places",
  });

const couponFields = {
  description: z.string().trim().min(1).max(300).nullable().optional(),
  type: z.enum(discountTypes),
  value: moneySchema,
  minOrderAmount: moneySchema.nullable().optional(),
  maxDiscount: moneySchema.nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  usageLimitPerUser: z.number().int().positive().max(100).optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  isActive: z.boolean().optional(),
};

export const createCouponSchema = z
  .object({
    code: couponCodeSchema,
    ...couponFields,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.endsAt <= value.startsAt) {
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "endsAt must be after startsAt",
      });
    }

    if (value.type === "PERCENTAGE" && value.value > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Percentage discount cannot exceed 100",
      });
    }
  });

export const updateCouponSchema = z
  .object({
    description: couponFields.description,
    type: couponFields.type.optional(),
    value: couponFields.value.optional(),
    minOrderAmount: couponFields.minOrderAmount,
    maxDiscount: couponFields.maxDiscount,
    usageLimit: couponFields.usageLimit,
    usageLimitPerUser: couponFields.usageLimitPerUser,
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const applyCouponSchema = z
  .object({
    code: couponCodeSchema,
    orderId: z.uuid().optional(),
  })
  .strict();

export const couponIdParamSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

const booleanQuerySchema = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === "true"));

export const couponListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    isActive: booleanQuerySchema,
    search: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value.toUpperCase() : undefined)),
  })
  .strict();

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
export type ApplyCouponInput = z.infer<typeof applyCouponSchema>;
export type CouponIdParam = z.infer<typeof couponIdParamSchema>;
export type CouponListQuery = z.infer<typeof couponListQuerySchema>;
