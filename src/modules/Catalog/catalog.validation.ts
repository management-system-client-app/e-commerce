import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase and hyphenated");

export const createSizeSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    slug: slugSchema.optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .strict();

export const createFabricSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    slug: slugSchema.optional(),
    composition: z.string().trim().min(1).max(200).nullable().optional(),
  })
  .strict();

export const catalogListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export type CreateSizeInput = z.infer<typeof createSizeSchema>;
export type CreateFabricInput = z.infer<typeof createFabricSchema>;
export type CatalogListQuery = z.infer<typeof catalogListQuerySchema>;
