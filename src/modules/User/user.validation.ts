import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

export const registerUserSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.email().transform((value) => value.toLowerCase()),
    password: passwordSchema,
    confirmPassword: z.string(),
    phone: z.string().trim().min(7).max(20).optional(),
  })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .transform(({ confirmPassword: _confirmPassword, ...user }) => user);

export const userIdParamSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export type RegisterUserInput = z.infer<typeof registerUserSchema>;
export type UserIdParam = z.infer<typeof userIdParamSchema>;
