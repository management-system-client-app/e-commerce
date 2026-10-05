import { spawn } from "node:child_process";
import path from "node:path";
import { Client } from "pg";
import { env } from "./env";

const SAFE_DB_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

const connectionUrl = (databaseUrl: string, databaseName?: string): string => {
  const url = new URL(databaseUrl);

  if (databaseName) {
    url.pathname = `/${databaseName}`;
  }

  url.searchParams.delete("schema");
  return url.toString();
};

const databaseNameFrom = (databaseUrl: string): string => {
  let name: string;

  try {
    name = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ""));
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL connection string.");
  }

  if (!SAFE_DB_NAME.test(name)) {
    throw new Error(
      "DATABASE_URL database name must start with a letter and use only letters, numbers, and underscores.",
    );
  }

  return name;
};

const isPgError = (error: unknown): error is { code?: string } =>
  typeof error === "object" && error !== null && "code" in error;

const explainConnectionError = (error: unknown): Error => {
  const code = isPgError(error) ? error.code : undefined;

  if (code === "28P01" || code === "28000") {
    return new Error(
      "PostgreSQL rejected DATABASE_URL. Set the username and password in .env to this computer's PostgreSQL account.",
    );
  }

  if (code === "ECONNREFUSED" || code === "ENOTFOUND") {
    return new Error("PostgreSQL is not running on this computer. Start it, then run the server again.");
  }

  return error instanceof Error ? error : new Error("Could not reach PostgreSQL");
};

const connect = async (connectionString: string): Promise<Client> => {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    return client;
  } catch (error) {
    await client.end().catch(() => undefined);
    throw error;
  }
};

const ensureDatabase = async (): Promise<void> => {
  const name = databaseNameFrom(env.DATABASE_URL);

  try {
    const client = await connect(connectionUrl(env.DATABASE_URL));
    await client.end();
    return;
  } catch (error) {
    if (!isPgError(error) || error.code !== "3D000") {
      throw explainConnectionError(error);
    }
  }

  let admin: Client | undefined;
  let lastError: unknown;

  for (const maintenanceDb of ["postgres", "template1"]) {
    try {
      admin = await connect(connectionUrl(env.DATABASE_URL, maintenanceDb));
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!admin) {
    throw explainConnectionError(lastError);
  }

  try {
    const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);

    if (existing.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${name}"`);
      console.log(`Database created: ${name}`);
    }
  } finally {
    await admin.end();
  }
};

const applyMigrations = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const bin = path.join(
      process.cwd(),
      "node_modules",
      ".bin",
      process.platform === "win32" ? "prisma.cmd" : "prisma",
    );
    const child = spawn(bin, ["migrate", "deploy"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(new Error("Prisma CLI was not found. Run pnpm install, then start the server again."));
        return;
      }

      reject(error);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Database migration failed (exit ${code ?? "unknown"}).`));
    });
  });

export const bootstrapDatabase = async (): Promise<void> => {
  await ensureDatabase();
  await applyMigrations();
};
