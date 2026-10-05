import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase and hyphenated");

const optionalText = (max: number) =>
  z.string().trim().min(1).max(max).nullable().optional();

export const createBrandSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: slugSchema.optional(),
    description: optionalText(1000),
    logoUrl: z.url().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

const booleanQuerySchema = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === "true"));

export const brandListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    isActive: booleanQuerySchema,
    search: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type BrandListQuery = z.infer<typeof brandListQuerySchema>;
