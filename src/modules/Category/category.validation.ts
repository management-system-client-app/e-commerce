import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase and hyphenated");

const optionalText = (max: number) =>
  z.string().trim().min(1).max(max).nullable().optional();

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: slugSchema.optional(),
    description: optionalText(1000),
    imageUrl: z.url().nullable().optional(),
    parentId: z.uuid().nullable().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .strict();

const booleanQuerySchema = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === "true"));

export const categoryListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    isActive: booleanQuerySchema,
    search: z.string().trim().min(1).max(120).optional(),
    parentId: z.uuid().optional(),
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    slug: slugSchema.optional(),
    description: optionalText(1000),
    imageUrl: z.url().nullable().optional(),
    parentId: z.uuid().nullable().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const categoryIdParamSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CategoryIdParam = z.infer<typeof categoryIdParamSchema>;
export type CategoryListQuery = z.infer<typeof categoryListQuerySchema>;
