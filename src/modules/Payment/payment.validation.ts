import { z } from "zod";

export const createPaymentIntentSchema = z
  .object({
    orderId: z.uuid(),
  })
  .strict();

export const submitManualPaymentSchema = z
  .object({
    orderId: z.uuid().optional(),
    orderNumber: z.string().trim().min(4).max(40).optional(),
    phone: z.string().trim().min(7).max(20).optional(),
    transactionId: z
      .string()
      .trim()
      .min(4)
      .max(40)
      .transform((value) => value.toUpperCase())
      .refine((value) => /^[A-Z0-9]+$/.test(value), {
        message: "Transaction id can contain only letters and numbers",
      }),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.orderId && !(value.orderNumber && value.phone)) {
      ctx.addIssue({
        code: "custom",
        message: "Send orderId, or orderNumber and phone",
      });
    }
  });

export const manualPaymentIdParamSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export const rejectManualPaymentSchema = z
  .object({
    reason: z.string().trim().min(1).max(300),
  })
  .strict();

export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>;
export type SubmitManualPaymentInput = z.infer<typeof submitManualPaymentSchema>;
export type ManualPaymentIdParam = z.infer<typeof manualPaymentIdParamSchema>;
export type RejectManualPaymentInput = z.infer<typeof rejectManualPaymentSchema>;
