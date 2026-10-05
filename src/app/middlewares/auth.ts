import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { AdminRole } from "../../../generated/prisma/enums";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { AppError } from "../errors/AppError";
import { isTokenRevoked } from "../../modules/Auth/auth.service";
import {
  accountRoles,
  type AccessTokenPayload,
  type AccountRole,
} from "../../utils/generateToken";

export type AuthContext = {
  id: string;
  email: string;
  role: AccountRole;
  adminRole?: AdminRole;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

const isAccountRole = (value: unknown): value is AccountRole => {
  return typeof value === "string" && accountRoles.includes(value as AccountRole);
};

const readBearerToken = (header: string | undefined): string => {
  if (!header) {
    throw AppError.unauthorized("Access token is required");
  }

  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw AppError.unauthorized("Access token is required");
  }

  return token;
};

const readPayload = (token: string): AccessTokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });

    if (typeof decoded === "string" || !isAccountRole(decoded.role)) {
      throw AppError.unauthorized("Invalid token");
    }

    const subject = decoded.sub;
    const email = decoded.email;

    if (typeof subject !== "string" || typeof email !== "string") {
      throw AppError.unauthorized("Invalid token");
    }

    return {
      sub: subject,
      email,
      role: decoded.role,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized("Token has expired");
    }

    throw AppError.unauthorized("Invalid token");
  }
};

const resolveAccount = async (payload: AccessTokenPayload): Promise<AuthContext> => {
  if (payload.role === "ADMIN") {
    const admin = await prisma.admin.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!admin || !admin.isActive) {
      throw AppError.unauthorized("Unauthorized");
    }

    return {
      id: admin.id,
      email: admin.email,
      role: "ADMIN",
      adminRole: admin.role,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw AppError.unauthorized("Unauthorized");
  }

  return {
    id: user.id,
    email: user.email,
    role: "USER",
  };
};

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  void (async () => {
    const token = readBearerToken(req.headers.authorization);
    const payload = readPayload(token);

    if (await isTokenRevoked(token)) {
      throw AppError.unauthorized("Token has been revoked");
    }

    req.auth = await resolveAccount(payload);
    next();
  })().catch(next);
};

const bearerToken = (header: string | undefined): string => {
  const value = header?.trim() ?? "";
  if (!value.startsWith("Bearer ")) {
    return "";
  }

  return value.slice("Bearer ".length).trim();
};

export const authenticateOptional = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const token = bearerToken(req.headers.authorization);

  if (!token) {
    next();
    return;
  }

  void (async () => {
    try {
      const payload = readPayload(token);

      if (await isTokenRevoked(token)) {
        next();
        return;
      }

      req.auth = await resolveAccount(payload);
      next();
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 401) {
        next();
        return;
      }

      throw error;
    }
  })().catch(next);
};

export const authorize =
  (...roles: AccountRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(AppError.unauthorized());
      return;
    }

    if (!roles.includes(req.auth.role)) {
      next(AppError.forbidden("You do not have permission to perform this action"));
      return;
    }

    next();
  };
