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

export const saveAddressSchema = z
  .object({
    label: z.string().trim().min(1).max(40).optional(),
    fullName: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(7).max(20),
    line1: z.string().trim().min(1).max(200),
    line2: z.string().trim().min(1).max(200).nullable().optional(),
    city: z.string().trim().min(1).max(80),
    state: z.string().trim().min(1).max(80).nullable().optional(),
    postalCode: z.string().trim().min(1).max(20),
    country: z.string().trim().min(2).max(80),
  })
  .strict();

export const updateProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    phone: z.string().trim().min(7).max(20).nullable().optional(),
    avatarUrl: z.url().nullable().optional(),
    currentPassword: z.string().min(1).optional(),
    newPassword: passwordSchema.optional(),
    confirmPassword: z.string().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const changingPassword = value.newPassword !== undefined || value.confirmPassword !== undefined;

    if (!changingPassword && value.currentPassword === undefined) {
      const profileFields = ["firstName", "lastName", "phone", "avatarUrl"] as const;
      if (!profileFields.some((field) => value[field] !== undefined)) {
        ctx.addIssue({
          code: "custom",
          message: "At least one field is required",
        });
      }
    }

    if (value.currentPassword && !value.newPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "New password is required",
      });
    }

    if (changingPassword && !value.currentPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["currentPassword"],
        message: "Current password is required",
      });
    }

    if (changingPassword && value.newPassword !== value.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
  });

export type RegisterUserInput = z.infer<typeof registerUserSchema>;
export type UserIdParam = z.infer<typeof userIdParamSchema>;
export type SaveAddressInput = z.infer<typeof saveAddressSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
