import { rateLimit } from "express-rate-limit";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export const passwordResetRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many password reset attempts. Please try again in 15 minutes",
  },
});

export const orderTrackRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many tracking attempts. Please try again in 15 minutes",
  },
});

export const newsletterRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many subscription attempts. Please try again in 15 minutes",
  },
});

export const authRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Too many login attempts. Please try again in 15 minutes",
  },
});
