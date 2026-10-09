import { z } from "zod";

const homeBlockKinds = ["BANNER", "CAMPAIGN", "NEW_ARRIVAL", "TRENDING"] as const;

const optionalText = (max: number) =>
  z.string().trim().min(1).max(max).nullable().optional();

const optionalDate = z.iso.datetime().nullable().optional();

const homeBlockFields = {
  title: z.string().trim().min(2).max(160),
  subtitle: optionalText(300),
  imageUrl: z.url().nullable().optional(),
  productIds: z.array(z.uuid()).max(24).refine((ids) => new Set(ids).size === ids.length, {
    message: "Products must not contain duplicates",
  }).optional(),
  linkUrl: optionalText(500),
  categoryId: z.uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
  startsAt: optionalDate,
  endsAt: optionalDate,
};

const scheduleIsValid = (
  value: { startsAt?: string | null; endsAt?: string | null },
  ctx: z.RefinementCtx,
): void => {
  if (!value.startsAt || !value.endsAt) {
    return;
  }

  if (new Date(value.endsAt).getTime() <= new Date(value.startsAt).getTime()) {
    ctx.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "endsAt must be after startsAt",
    });
  }
};

export const createHomeBlockSchema = z
  .object({
    kind: z.enum(homeBlockKinds),
    ...homeBlockFields,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kind === "BANNER" && !value.imageUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["imageUrl"],
        message: "A banner needs an image",
      });
    }

    scheduleIsValid(value, ctx);
  });

export const updateHomeBlockSchema = z
  .object({
    kind: z.enum(homeBlockKinds).optional(),
    ...homeBlockFields,
    title: z.string().trim().min(2).max(160).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  })
  .superRefine((value, ctx) => {
    if (value.kind === "BANNER" && value.imageUrl === null) {
      ctx.addIssue({
        code: "custom",
        path: ["imageUrl"],
        message: "A banner needs an image",
      });
    }

    scheduleIsValid(value, ctx);
  });

export const homeBlockIdParamSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export type CreateHomeBlockInput = z.infer<typeof createHomeBlockSchema>;
export type UpdateHomeBlockInput = z.infer<typeof updateHomeBlockSchema>;
export type HomeBlockIdParam = z.infer<typeof homeBlockIdParamSchema>;
