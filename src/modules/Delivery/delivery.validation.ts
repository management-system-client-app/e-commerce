import { z } from "zod";

const decimalMoney = (schema: z.ZodNumber) =>
  schema.max(99_999_999.99).refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
    message: "Amount can have at most 2 decimal places",
  });

const zoneFields = {
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(80).nullable().optional(),
  fee: decimalMoney(z.number().nonnegative()),
  freeShippingOver: decimalMoney(z.number().positive()).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
};

export const createDeliveryZoneSchema = z.object(zoneFields).strict();

export const updateDeliveryZoneSchema = z
  .object({
    ...zoneFields,
    name: zoneFields.name.optional(),
    fee: zoneFields.fee.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const deliveryZoneIdParamSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export const deliveryQuoteQuerySchema = z
  .object({
    city: z.string().trim().min(2).max(80),
    subtotal: z.preprocess(
      (value) => (value === "" || value === undefined || value === null ? undefined : value),
      z.coerce.number().nonnegative().max(99_999_999.99).default(0),
    ),
  })
  .strict();

export type CreateDeliveryZoneInput = z.infer<typeof createDeliveryZoneSchema>;
export type UpdateDeliveryZoneInput = z.infer<typeof updateDeliveryZoneSchema>;
export type DeliveryZoneIdParam = z.infer<typeof deliveryZoneIdParamSchema>;
export type DeliveryQuoteQuery = z.infer<typeof deliveryQuoteQuerySchema>;
