import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Application, type Request, type Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./app/config/env";
import { NotFoundError } from "./app/errors/NotFoundError";
import { globalErrorHandler } from "./app/middlewares/globalErrorHandler";
import logger from "./config/logger";
import routes from "./routes";

const app: Application = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
  }),
);

app.use(compression());
app.use(cookieParser(env.COOKIE_SECRET));

const jsonParser = express.json({ limit: "10kb" });

app.use((req, res, next) => {
  if (req.path === "/api/v1/payments/webhook") {
    next();
    return;
  }

  jsonParser(req, res, next);
});

app.use(express.urlencoded({ extended: true, limit: "10kb" }));

const morganStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

app.use(
  morgan(env.NODE_ENV === "development" ? "dev" : "combined", {
    stream: morganStream,
  }),
);

app.get("/", (_req: Request, res: Response) => {
  res.status(200).type("html").send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>server is running</title>
  </head>
  <body>
    <h1>server is running</h1>
  </body>
</html>`);
});

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/v1", routes);

app.use((req, _res, next) => {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
});

app.use(globalErrorHandler);

export default app;
