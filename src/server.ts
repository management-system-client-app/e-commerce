import type { Server } from "http";
import app from "./app";
import { env } from "./app/config/env";
import { prisma } from "./app/config/prisma";
import logger from "./config/logger";
import { authService } from "./modules/Auth/auth.service";

let server: Server | undefined;
let isShuttingDown = false;

const shutdown = (reason: string, exitCode: number): void => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info(`${reason} received. Shutting down.`);

  const closeDatabase = (): void => {
    prisma
      .$disconnect()
      .catch((error: unknown) => {
        logger.error("Failed to disconnect Prisma", { error });
      })
      .finally(() => {
        process.exit(exitCode);
      });
  };

  if (!server) {
    closeDatabase();
    return;
  }

  const forceExit = setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(exitCode);
  }, 10_000);
  forceExit.unref();

  server.closeAllConnections();
  server.close(() => {
    clearTimeout(forceExit);
    closeDatabase();
  });
};

process.on("unhandledRejection", (reason: unknown) => {
  logger.error("Unhandled promise rejection", { reason });
  shutdown("unhandledRejection", 1);
});

process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught exception", {
    message: error.message,
    stack: error.stack,
  });
  shutdown("uncaughtException", 1);
});

process.on("SIGINT", () => {
  shutdown("SIGINT", 0);
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM", 0);
});

process.on("SIGTSTP", () => {
  shutdown("SIGTSTP", 0);
});

const MAX_BIND_ATTEMPTS = 10;

const listen = (attempt: number): void => {
  const instance = app.listen(env.PORT, () => {
    console.log(`Server is running on http://localhost:${env.PORT}`);
  });

  server = instance;

  instance.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE" && attempt < MAX_BIND_ATTEMPTS) {
      logger.warn(`Port ${env.PORT} is busy. Waiting for it to be released.`);
      setTimeout(() => listen(attempt + 1), 500);
      return;
    }

    if (error.code === "EADDRINUSE") {
      logger.error(
        `Port ${env.PORT} is already in use. Close the other process or change PORT.`,
      );
    } else {
      logger.error("Server failed to start", { message: error.message });
    }

    shutdown("server-error", 1);
  });
};

void authService.ensureDefaultAdmin().then(
  () => {
    listen(1);
  },
  (error: unknown) => {
    logger.error("Something went wrong while starting the server", { error });
    shutdown("startup-error", 1);
  },
);
