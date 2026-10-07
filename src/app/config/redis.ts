import Redis from "ioredis";
import logger from "../../config/logger";
import { env } from "./env";

const createClient = (): Redis | null => {
  if (!env.REDIS_URL) {
    return null;
  }

  const client = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2_000,
    retryStrategy(times) {
      return Math.min(times * 200, 5_000);
    },
  });

  client.on("error", (error: Error) => {
    logger.warn("Redis error", { message: error.message });
  });

  return client;
};

export const redis = createClient();

export const connectRedis = async (): Promise<void> => {
  if (!redis) {
    logger.info("REDIS_URL is not set. Catalog and product reads will use Postgres.");
    return;
  }

  try {
    if (redis.status === "wait") {
      await redis.connect();
    }

    logger.info("Redis connected");
  } catch (error) {
    logger.warn("Redis is unavailable. Catalog and product reads will use Postgres.", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }
};

export const disconnectRedis = async (): Promise<void> => {
  if (!redis) {
    return;
  }

  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
};
