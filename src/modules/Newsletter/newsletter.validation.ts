import { z } from "zod";

export const subscribeNewsletterSchema = z
  .object({
    email: z.email().transform((value) => value.toLowerCase()),
  })
  .strict();

export const newsletterIdParamSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export type SubscribeNewsletterInput = z.infer<typeof subscribeNewsletterSchema>;
export type NewsletterIdParam = z.infer<typeof newsletterIdParamSchema>;
