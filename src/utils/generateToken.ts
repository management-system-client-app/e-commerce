import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../app/config/env";

export const accountRoles = ["USER", "ADMIN"] as const;

export type AccountRole = (typeof accountRoles)[number];

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: AccountRole;
};

export const generateAccessToken = (payload: AccessTokenPayload): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    algorithm: "HS256",
  };

  return jwt.sign(payload, env.JWT_SECRET, options);
};
