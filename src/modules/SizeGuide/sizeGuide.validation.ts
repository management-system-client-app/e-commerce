import { z } from "zod";

const columnSchema = z.string().trim().min(1).max(40);
const rowSchema = z.array(z.string().trim().max(40)).min(1).max(12);

const chartFields = {
  title: z.string().trim().min(2).max(160),
  columns: z.array(columnSchema).min(1).max(12),
  rows: z.array(rowSchema).min(1).max(40),
  isActive: z.boolean().optional(),
};

const rowsMatchColumns = (
  value: { columns?: string[]; rows?: string[][] },
  ctx: z.RefinementCtx,
): void => {
  if (!value.columns || !value.rows) {
    return;
  }

  value.rows.forEach((row, index) => {
    if (row.length !== value.columns!.length) {
      ctx.addIssue({
        code: "custom",
        path: ["rows", index],
        message: "Each row must have one cell for every column",
      });
    }
  });
};

export const createSizeGuideSchema = z
  .object({
    categoryId: z.uuid(),
    ...chartFields,
  })
  .strict()
  .superRefine(rowsMatchColumns);

export const updateSizeGuideSchema = z
  .object({
    categoryId: z.uuid().optional(),
    ...chartFields,
    title: chartFields.title.optional(),
    columns: chartFields.columns.optional(),
    rows: chartFields.rows.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  })
  .superRefine(rowsMatchColumns);

export const sizeGuideIdParamSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export const sizeGuideListQuerySchema = z
  .object({
    categoryId: z.uuid().optional(),
  })
  .strict();

export type CreateSizeGuideInput = z.infer<typeof createSizeGuideSchema>;
export type UpdateSizeGuideInput = z.infer<typeof updateSizeGuideSchema>;
export type SizeGuideIdParam = z.infer<typeof sizeGuideIdParamSchema>;
export type SizeGuideListQuery = z.infer<typeof sizeGuideListQuerySchema>;
