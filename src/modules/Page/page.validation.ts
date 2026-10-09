import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase and hyphenated");

export const upsertPageSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    body: z.string().trim().min(1).max(20_000),
    isActive: z.boolean().optional(),
  })
  .strict();

export const pageSlugParamSchema = z
  .object({
    slug: slugSchema,
  })
  .strict();

export type UpsertPageInput = z.infer<typeof upsertPageSchema>;
export type PageSlugParam = z.infer<typeof pageSlugParamSchema>;
