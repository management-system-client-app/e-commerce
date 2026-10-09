import type { ErrorRequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { Prisma } from "../../../generated/prisma/client";
import logger from "../../config/logger";
import { AppError } from "../errors/AppError";
import { env } from "../config/env";

type FieldError = {
  path: string;
  message: string;
};

type ErrorResponseBody = {
  success: false;
  message: string;
  errors?: FieldError[];
  stack?: string;
};

type ResolvedError = {
  statusCode: number;
  message: string;
  errors?: FieldError[];
};

const isJsonParseError = (error: unknown): error is SyntaxError => {
  if (!(error instanceof SyntaxError)) {
    return false;
  }

  const parseError = error as SyntaxError & { status?: number; type?: string };
  return parseError.status === 400 && parseError.type === "entity.parse.failed";
};

const uniqueConstraintMessage = (meta?: Record<string, unknown>): string => {
  const target = meta?.target;

  if (Array.isArray(target) && target.length > 0) {
    return `${target.join(", ")} already exists`;
  }

  if (typeof target === "string" && target.length > 0) {
    return `${target} already exists`;
  }

  return "A record with this value already exists";
};

const resolvePrismaError = (
  error: Prisma.PrismaClientKnownRequestError,
): ResolvedError => {
  switch (error.code) {
    case "P2002":
      return {
        statusCode: 409,
        message: uniqueConstraintMessage(error.meta),
      };
    case "P2025":
      return {
        statusCode: 404,
        message: "Record not found",
      };
    case "P2003":
      return {
        statusCode: 400,
        message: "Related record does not exist",
      };
    default:
      return {
        statusCode: 500,
        message: "Database request failed",
      };
  }
};

const resolveError = (error: unknown): ResolvedError => {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
      errors: Array.isArray(error.details)
        ? (error.details as FieldError[])
        : undefined,
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 422,
      message: "Validation failed",
      errors: error.issues.map((issue) => ({
        path: issue.path.map(String).join(".") || "body",
        message: issue.message,
      })),
    };
  }

  if (isJsonParseError(error)) {
    return {
      statusCode: 400,
      message: "Invalid JSON body",
    };
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Each image must be 5MB or smaller"
        : error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE"
          ? "You can upload up to 6 images"
          : "Image upload failed";

    return {
      statusCode: 400,
      message,
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return resolvePrismaError(error);
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      statusCode: 400,
      message: "Invalid database query",
    };
  }

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    return {
      statusCode: 503,
      message: "Database is unavailable",
    };
  }

  return {
    statusCode: 500,
    message:
      env.NODE_ENV === "production"
        ? "Internal server error"
        : error instanceof Error
          ? error.message
          : "Internal server error",
  };
};

export const globalErrorHandler: ErrorRequestHandler = (
  error,
  req,
  res,
  next,
) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const resolved = resolveError(error);
  const logPayload = {
    method: req.method,
    path: req.originalUrl,
    statusCode: resolved.statusCode,
    stack: error instanceof Error ? error.stack : undefined,
  };

  if (resolved.statusCode >= 500) {
    logger.error(resolved.message, logPayload);
  } else {
    logger.warn(resolved.message, logPayload);
  }

  const body: ErrorResponseBody = {
    success: false,
    message: resolved.message,
  };

  if (resolved.errors && resolved.errors.length > 0) {
    body.errors = resolved.errors;
  }

  if (env.NODE_ENV === "development" && error instanceof Error && error.stack) {
    body.stack = error.stack;
  }

  res.status(resolved.statusCode).json(body);
};
