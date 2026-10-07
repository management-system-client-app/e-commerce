import logger from "../../config/logger";
import { redis } from "./redis";

export const CATALOG_CACHE_TTL_SECONDS = 120;
export const PRODUCT_CACHE_TTL_SECONDS = 45;

type CacheScope = "catalog" | "products";

const versionKey = (scope: CacheScope): string => `shop:${scope}:version`;

const warn = (action: string, error: unknown): void => {
  logger.warn(`Cache ${action} failed`, {
    message: error instanceof Error ? error.message : "unknown",
  });
};

const ready = (): boolean => redis !== null && redis.status === "ready";

export const cacheKey = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => cacheKey(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${cacheKey(entry)}`)
    .join(",")}}`;
};

export const cacheGetOrSet = async <T>(
  scope: CacheScope,
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> => {
  if (!ready() || !redis) {
    return loader();
  }

  let version = "0";

  try {
    version = (await redis.get(versionKey(scope))) ?? "0";
  } catch (error) {
    warn("read", error);
    return loader();
  }

  const fullKey = `shop:${scope}:v${version}:${key}`;

  try {
    const hit = await redis.get(fullKey);

    if (hit) {
      return JSON.parse(hit) as T;
    }
  } catch (error) {
    warn("read", error);
    return loader();
  }

  const value = await loader();

  try {
    await redis.set(fullKey, JSON.stringify(value), "EX", ttlSeconds);
  } catch (error) {
    warn("write", error);
  }

  return value;
};

export const invalidateCache = async (...scopes: CacheScope[]): Promise<void> => {
  const client = redis;

  if (!client || client.status !== "ready") {
    return;
  }

  try {
    await Promise.all(scopes.map((scope) => client.incr(versionKey(scope))));
  } catch (error) {
    warn("invalidate", error);
  }
};
