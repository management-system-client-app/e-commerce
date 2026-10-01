import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_SECRET: z.string().min(10, "JWT_SECRET must be at least 10 characters"),
  JWT_EXPIRES_IN: z.string().min(1).default("7d"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(10, "JWT_REFRESH_SECRET must be at least 10 characters"),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1).default("30d"),

  ALLOWED_ORIGINS: z.string().min(1).default("http://localhost:3000"),
  COOKIE_SECRET: z
    .string()
    .min(10, "COOKIE_SECRET must be at least 10 characters"),

  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("\n");

  console.error(`Invalid environment variables:\n${details}`);
  process.exit(1);
}

const data = parsedEnv.data;

export const env = {
  ...data,
  ALLOWED_ORIGINS: data.ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),
};

export type Env = typeof env;
