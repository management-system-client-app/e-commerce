import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().min(1).max(max).nullable().optional();

export const updateSettingsSchema = z
  .object({
    storeName: z.string().trim().min(2).max(120).optional(),
    supportEmail: z.email().nullable().optional(),
    supportPhone: z.string().trim().min(7).max(20).nullable().optional(),
    address: optionalText(300),
    facebookUrl: z.url().nullable().optional(),
    instagramUrl: z.url().nullable().optional(),
    bkashNumber: z.string().trim().min(7).max(20).nullable().optional(),
    nagadNumber: z.string().trim().min(7).max(20).nullable().optional(),
    rocketNumber: z.string().trim().min(7).max(20).nullable().optional(),
    collageManImageUrl: z.url().nullable().optional(),
    collageWomanImageUrl: z.url().nullable().optional(),
    collageChildImageUrl: z.url().nullable().optional(),
    collageAccessoriesImageUrl: z.url().nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const collageImageSlotSchema = z.object({
  slot: z.enum(["man", "woman", "child", "accessories"]),
});

export const uploadCollageImageSchema = z.object({
  imageUrl: z.url(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type CollageImageSlot = z.infer<typeof collageImageSlotSchema>["slot"];
