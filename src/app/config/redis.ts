import logger from "../../config/logger";
import { env } from "./env";

type UpstashResult = string | number | null;

const target = (): { url: string; token: string } | null => {
  if (!env.REDIS_URL) {
    return null;
  }

  try {
    const parsed = new URL(env.REDIS_URL);
    const token = decodeURIComponent(parsed.password);

    if (!parsed.hostname || !token) {
      return null;
    }

    return {
      url: `https://${parsed.hostname}`,
      token,
    };
  } catch {
    return null;
  }
};

export const redisEnabled = target() !== null;

let loggedMissingUrl = false;

export const upstashCommand = async (
  command: Array<string | number>,
): Promise<UpstashResult> => {
  const redis = target();

  if (!redis) {
    if (!loggedMissingUrl) {
      loggedMissingUrl = true;
      logger.info("REDIS_URL is not set. Catalog and product reads will use Postgres.");
    }

    throw new Error("REDIS_URL is not set");
  }

  const response = await fetch(redis.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redis.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  const body = (await response.json()) as { result?: UpstashResult; error?: string };

  if (!response.ok || body.error) {
    throw new Error(body.error || `Upstash request failed (${response.status})`);
  }

  return body.result ?? null;
};
