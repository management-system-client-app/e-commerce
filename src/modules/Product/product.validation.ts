import { z } from "zod";

const productStatuses = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
const genders = ["MEN", "WOMEN", "UNISEX", "KIDS"] as const;
const fits = ["SLIM", "REGULAR", "RELAXED", "OVERSIZED"] as const;

const priceSchema = z
  .number()
  .positive("Price must be greater than 0")
  .max(99_999_999.99)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
    message: "Price can have at most 2 decimal places",
  });

const optionalText = (max: number) =>
  z.string().trim().min(1).max(max).nullable().optional();

const productSizeSchema = z
  .object({
    sizeId: z.uuid(),
    fabricId: z.uuid(),
    colorId: z.uuid().nullable().optional(),
    stock: z.number().int().min(0).default(0),
    price: priceSchema.nullable().optional(),
    sku: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .transform((value) => value.toUpperCase())
      .optional(),
  })
  .strict();

export const createProductSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(180)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase and hyphenated")
      .optional(),
    description: z.string().trim().min(1).max(5000),
    status: z.enum(productStatuses).optional(),
    gender: z.enum(genders),
    fit: z.enum(fits).nullable().optional(),
    careInstructions: optionalText(1000),
    basePrice: priceSchema,
    compareAtPrice: priceSchema.nullable().optional(),
    brandId: z.uuid(),
    categoryId: z.uuid(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    metaTitle: optionalText(160),
    metaDescription: optionalText(320),
    sizes: z.array(productSizeSchema).min(1).max(30).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.compareAtPrice != null &&
      value.compareAtPrice <= value.basePrice
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["compareAtPrice"],
        message: "compareAtPrice must be greater than basePrice",
      });
    }

    const combinations = new Set<string>();
    const skus = new Set<string>();

    for (const [index, size] of (value.sizes ?? []).entries()) {
      const combination = `${size.sizeId}:${size.fabricId}:${size.colorId ?? ""}`;

      if (combinations.has(combination)) {
        ctx.addIssue({
          code: "custom",
          path: ["sizes", index],
          message: "This size, fabric, and color combination is already in the list",
        });
      }

      combinations.add(combination);

      if (!size.sku) {
        continue;
      }

      if (skus.has(size.sku)) {
        ctx.addIssue({
          code: "custom",
          path: ["sizes", index, "sku"],
          message: "SKU is already used in this list",
        });
      }

      skus.add(size.sku);
    }
  });

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(180)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase and hyphenated")
      .optional(),
    description: z.string().trim().min(1).max(5000).optional(),
    status: z.enum(productStatuses).optional(),
    gender: z.enum(genders).optional(),
    fit: z.enum(fits).nullable().optional(),
    careInstructions: optionalText(1000),
    basePrice: priceSchema.optional(),
    compareAtPrice: priceSchema.nullable().optional(),
    brandId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    metaTitle: optionalText(160),
    metaDescription: optionalText(320),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const productIdParamSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

const productSorts = ["latest", "price_asc", "price_desc", "name_asc"] as const;

const optionalQueryPrice = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? undefined : value),
  z.coerce.number().nonnegative().max(99_999_999.99).optional(),
);

export const productListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : undefined)),
    status: z.enum(productStatuses).optional(),
    gender: z.enum(genders).optional(),
    categoryId: z.uuid().optional(),
    brandId: z.uuid().optional(),
    sizeId: z.uuid().optional(),
    colorId: z.uuid().optional(),
    fabricId: z.uuid().optional(),
    inStock: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === "true")),
    sort: z.enum(productSorts).default("latest"),
    minPrice: optionalQueryPrice,
    maxPrice: optionalQueryPrice,
  })
  .strict()
  .superRefine((value, ctx) => {
    for (const [field, price] of [
      ["minPrice", value.minPrice],
      ["maxPrice", value.maxPrice],
    ] as const) {
      if (price == null) {
        continue;
      }

      if (Math.abs(price * 100 - Math.round(price * 100)) >= 1e-6) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Price can have at most 2 decimal places",
        });
      }
    }

    if (value.minPrice != null && value.maxPrice != null && value.minPrice > value.maxPrice) {
      ctx.addIssue({
        code: "custom",
        path: ["minPrice"],
        message: "minPrice cannot be greater than maxPrice",
      });
    }
  });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductIdParam = z.infer<typeof productIdParamSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
