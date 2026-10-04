export class AppError extends Error {
  readonly statusCode: number;
  readonly isOperational: boolean;
  readonly details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, new.target);
  }

  static badRequest(message = "Bad request", details?: unknown): AppError {
    return new AppError(message, 400, details);
  }

  static unauthorized(message = "Unauthorized"): AppError {
    return new AppError(message, 401);
  }

  static forbidden(message = "Forbidden"): AppError {
    return new AppError(message, 403);
  }

  static conflict(message = "Conflict", details?: unknown): AppError {
    return new AppError(message, 409, details);
  }

  static validation(message = "Validation failed", details?: unknown): AppError {
    return new AppError(message, 422, details);
  }

  static internal(message = "Internal server error"): AppError {
    return new AppError(message, 500);
  }
}
