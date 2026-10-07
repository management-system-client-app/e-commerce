import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";
import { env } from "./env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Serverless isolates each open their own pool. One connection keeps Postgres from filling up.
const poolMax = process.env.VERCEL ? 1 : env.DATABASE_POOL_MAX;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: env.DATABASE_URL,
      max: poolMax,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
    }),
    log: ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
