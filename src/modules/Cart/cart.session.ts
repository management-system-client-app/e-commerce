import type { CookieOptions, Request, Response } from "express";
import { z } from "zod";
import { env } from "../../app/config/env";
import { AppError } from "../../app/errors/AppError";

export const CART_SESSION_COOKIE = "cart_session";
export const CART_SESSION_HEADER = "x-cart-session";

const sessionIdSchema = z.uuid();

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  signed: true,
  sameSite: "lax",
  secure: env.NODE_ENV === "production",
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: "/",
});

export const readCartSessionId = (req: Request): string | null => {
  const header = req.get(CART_SESSION_HEADER)?.trim() ?? "";

  if (header) {
    const parsed = sessionIdSchema.safeParse(header);
    if (!parsed.success) {
      throw AppError.badRequest("Cart session id must be a UUID");
    }

    return parsed.data;
  }

  const signed = req.signedCookies?.[CART_SESSION_COOKIE];
  const cookie = typeof signed === "string" ? signed : "";
  const parsed = sessionIdSchema.safeParse(cookie);

  return parsed.success ? parsed.data : null;
};

export const setCartSessionCookie = (res: Response, sessionId: string): void => {
  res.cookie(CART_SESSION_COOKIE, sessionId, cookieOptions());
};

export const clearCartSessionCookie = (res: Response): void => {
  const { maxAge: _maxAge, ...options } = cookieOptions();
  res.clearCookie(CART_SESSION_COOKIE, options);
};
