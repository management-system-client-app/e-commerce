import { z } from "zod";

const orderStatuses = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURN_REQUESTED",
  "PARTIALLY_RETURNED",
  "RETURNED",
] as const;

export const placeOrderSchema = z
  .object({
    shippingFullName: z.string().trim().min(1).max(120),
    shippingPhone: z.string().trim().min(7).max(20),
    shippingLine1: z.string().trim().min(1).max(200),
    shippingLine2: z.string().trim().min(1).max(200).optional(),
    shippingCity: z.string().trim().min(1).max(80),
    shippingState: z.string().trim().min(1).max(80).optional(),
    shippingPostalCode: z.string().trim().min(1).max(20),
    shippingCountry: z.string().trim().min(2).max(80),
    customerNote: z.string().trim().min(1).max(500).optional(),
    email: z.email().optional(),
    couponCode: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .transform((value) => value.toUpperCase())
      .refine((value) => /^[A-Z0-9_-]+$/.test(value), {
        message: "Code can contain only letters, numbers, underscores, and hyphens",
      })
      .optional(),
  })
  .strict();

export const updateOrderStatusSchema = z
  .object({
    status: z.enum(orderStatuses),
    cancelReason: z.string().trim().min(1).max(300).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === "CANCELLED" && !value.cancelReason) {
      ctx.addIssue({
        code: "custom",
        path: ["cancelReason"],
        message: "A cancel reason is required",
      });
    }

    if (value.status !== "CANCELLED" && value.cancelReason) {
      ctx.addIssue({
        code: "custom",
        path: ["cancelReason"],
        message: "cancelReason is only allowed when cancelling an order",
      });
    }
  });

export const orderIdParamSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export const trackOrderQuerySchema = z
  .object({
    orderNumber: z.string().trim().min(4).max(40),
    phone: z.string().trim().min(7).max(20),
  })
  .strict();

export const orderListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(orderStatuses).optional(),
  })
  .strict();

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type OrderIdParam = z.infer<typeof orderIdParamSchema>;
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
export type TrackOrderQuery = z.infer<typeof trackOrderQuerySchema>;
export type OrderStatusValue = (typeof orderStatuses)[number];
