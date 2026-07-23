import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// define what environment variables are required and their expected type
const envSchema = z.object({
  PORT: z.string().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(10, 'JWT_SECRET must be at least 10 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  JWT_REFRESH_SECRET: z.string().min(10, 'JWT_REFRESH_SECRET must be at least 10 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  ALLOWED_ORIGINS: z.string().optional(),

  COOKIE_SECRET: z.string().min(10, 'COOKIE_SECRET must be at least 10 characters').optional(),
});

// validate process.env against the schema — throws an error if something is missing/invalid
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:');
  console.error(parsedEnv.error.format());
  process.exit(1);   // stop the server immediately if config is wrong
}

export const env = parsedEnv.data;