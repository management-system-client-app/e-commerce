import { z } from "zod";

export const createPaymentIntentSchema = z
  .object({
    orderId: z.uuid(),
  })
  .strict();

export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>;
