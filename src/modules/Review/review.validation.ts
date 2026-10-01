import { z } from "zod";

export const createReviewSchema = z
  .object({
    productId: z.uuid(),
    rating: z.number().int().min(1).max(5),
    title: z.string().trim().min(2).max(120).optional(),
    comment: z.string().trim().min(2).max(1000),
  })
  .strict();

export const productReviewParamSchema = z
  .object({
    productId: z.uuid(),
  })
  .strict();

export const reviewListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(10),
  })
  .strict();

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type ProductReviewParam = z.infer<typeof productReviewParamSchema>;
export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>;
