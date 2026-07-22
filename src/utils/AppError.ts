class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;   // known/expected error, not an unexpected crash

    Error.captureStackTrace(this, this.constructor);
  }

  // 400 — invalid input / bad request data
  static badRequest(message = 'Bad request') {
    return new AppError(message, 400);
  }

  // 401 — user not logged in / invalid token
  static unauthorized(message = 'Unauthorized access') {
    return new AppError(message, 401);
  }

  // 403 — logged in but not allowed to do this action
  static forbidden(message = 'Forbidden') {
    return new AppError(message, 403);
  }

  // 404 — resource not found
  static notFound(message = 'Resource not found') {
    return new AppError(message, 404);
  }

  // 409 — conflict (e.g. email already exists)
  static conflict(message = 'Conflict occurred') {
    return new AppError(message, 409);
  }

  // 422 — validation failed
  static validationError(message = 'Validation failed') {
    return new AppError(message, 422);
  }

  // 429 — too many requests (rate limiting)
  static tooManyRequests(message = 'Too many requests') {
    return new AppError(message, 429);
  }

  // 500 — internal server error
  static internal(message = 'Internal server error') {
    return new AppError(message, 500);
  }

  // 500 — specifically for database-related failures
  static databaseError(message = 'Database operation failed') {
    return new AppError(message, 500);
  }

  // 401 — token expired specifically (useful for frontend to trigger refresh flow)
  static tokenExpired(message = 'Token has expired') {
    return new AppError(message, 401);
  }

  // 401 — token invalid/malformed
  static invalidToken(message = 'Invalid token') {
    return new AppError(message, 401);
  }

  // 402 — payment failed
  static paymentFailed(message = 'Payment failed') {
    return new AppError(message, 402);
  }

  // 400 — out of stock (ecommerce-specific)
  static outOfStock(message = 'Product is out of stock') {
    return new AppError(message, 400);
  }

  // 400 — cart related errors (empty cart, invalid quantity)
  static cartError(message = 'Cart operation failed') {
    return new AppError(message, 400);
  }

  // 503 — service unavailable (e.g. external payment gateway down)
  static serviceUnavailable(message = 'Service temporarily unavailable') {
    return new AppError(message, 503);
  }
}

export default AppError;