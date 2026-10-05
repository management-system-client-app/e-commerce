import { z } from "zod";

const priceSchema = z
  .number()
  .positive("Price must be greater than 0")
  .max(99_999_999.99)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
    message: "Price can have at most 2 decimal places",
  });

const skuSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .transform((value) => value.toUpperCase());

const booleanQuerySchema = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === "true"));

const optionalUuid = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.uuid().optional(),
);

export const createVariantSchema = z
  .object({
    productId: z.uuid(),
    sizeId: z.uuid(),
    colorId: optionalUuid,
    fabricId: z.uuid(),
    sku: skuSchema,
    barcode: z.string().trim().min(1).max(64).nullable().optional(),
    price: priceSchema.nullable().optional(),
    compareAtPrice: priceSchema.nullable().optional(),
    stock: z.number().int().min(0).default(0),
    lowStockThreshold: z.number().int().min(0).max(100_000).optional(),
    weightGrams: z.number().int().positive().max(100_000).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.price != null && value.compareAtPrice != null && value.compareAtPrice <= value.price) {
      ctx.addIssue({
        code: "custom",
        path: ["compareAtPrice"],
        message: "compareAtPrice must be greater than price",
      });
    }
  });

export const updateVariantSchema = z
  .object({
    sizeId: z.uuid().optional(),
    colorId: optionalUuid,
    fabricId: z.uuid().optional(),
    sku: skuSchema.optional(),
    barcode: z.string().trim().min(1).max(64).nullable().optional(),
    price: priceSchema.nullable().optional(),
    compareAtPrice: priceSchema.nullable().optional(),
    stock: z.number().int().min(0).optional(),
    lowStockThreshold: z.number().int().min(0).max(100_000).optional(),
    weightGrams: z.number().int().positive().max(100_000).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const variantIdParamSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export const variantListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    productId: z.uuid().optional(),
    sizeId: z.uuid().optional(),
    colorId: z.uuid().optional(),
    fabricId: z.uuid().optional(),
    isActive: booleanQuerySchema,
    inStock: booleanQuerySchema,
  })
  .strict();

export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
export type VariantIdParam = z.infer<typeof variantIdParamSchema>;
export type VariantListQuery = z.infer<typeof variantListQuerySchema>;
