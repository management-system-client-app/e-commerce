import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().min(1).max(max).nullable().optional();

const outletFields = {
  name: z.string().trim().min(2).max(160),
  address: z.string().trim().min(2).max(300),
  city: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(7).max(20),
  hours: optionalText(160),
  mapUrl: z.url().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
};

export const createOutletSchema = z.object(outletFields).strict();

export const updateOutletSchema = z
  .object({
    ...outletFields,
    name: outletFields.name.optional(),
    address: outletFields.address.optional(),
    city: outletFields.city.optional(),
    phone: outletFields.phone.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const outletIdParamSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export type CreateOutletInput = z.infer<typeof createOutletSchema>;
export type UpdateOutletInput = z.infer<typeof updateOutletSchema>;
export type OutletIdParam = z.infer<typeof outletIdParamSchema>;
