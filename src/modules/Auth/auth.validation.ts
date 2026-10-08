import { z } from "zod";

export const loginSchema = z
  .object({
    email: z.email().transform((value) => value.toLowerCase()),
    password: z.string().min(1, "Password is required"),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

export const forgotPasswordSchema = z
  .object({
    email: z.email().transform((value) => value.toLowerCase()),
  })
  .strict();

export const verifyResetCodeSchema = z
  .object({
    email: z.email().transform((value) => value.toLowerCase()),
    code: z.string().trim().regex(/^\d{6}$/, "Code must be 6 digits"),
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    email: z.email().transform((value) => value.toLowerCase()),
    code: z.string().trim().regex(/^\d{6}$/, "Code must be 6 digits"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type VerifyResetCodeInput = z.infer<typeof verifyResetCodeSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
