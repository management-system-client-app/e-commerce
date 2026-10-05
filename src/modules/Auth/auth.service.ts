import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../app/config/prisma";
import { AppError } from "../../app/errors/AppError";
import type { AuthContext } from "../../app/middlewares/auth";
import { comparePassword, hashPassword } from "../../utils/bcrypt";
import { generateAccessToken, type AccountRole } from "../../utils/generateToken";
import { env } from "../../app/config/env";
import type { LoginInput } from "./auth.validation";

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  avatarUrl: true,
  isEmailVerified: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  passwordHash: true,
} satisfies Prisma.UserSelect;

const adminSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  passwordHash: true,
} satisfies Prisma.AdminSelect;

let dummyPasswordHash: string | undefined;

const invalidPasswordHash = async (): Promise<string> => {
  dummyPasswordHash ??= await hashPassword("invalid-password-placeholder");
  return dummyPasswordHash;
};

const login = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: userSelect,
  });

  const passwordMatches = await comparePassword(
    input.password,
    user?.passwordHash ?? (await invalidPasswordHash()),
  );

  if (!user || !passwordMatches) {
    throw AppError.unauthorized("Invalid email or password");
  }

  if (!user.isActive) {
    throw AppError.forbidden("This account is disabled");
  }

  const lastLoginAt = new Date();

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt },
  });

  const { passwordHash: _passwordHash, ...safeUser } = user;

  return {
    token: generateAccessToken({
      sub: user.id,
      email: user.email,
      role: "USER" satisfies AccountRole,
    }),
    user: {
      ...safeUser,
      lastLoginAt,
    },
  };
};

const loginAdmin = async (input: LoginInput) => {
  const admin = await prisma.admin.findUnique({
    where: { email: input.email },
    select: adminSelect,
  });

  const passwordMatches = await comparePassword(
    input.password,
    admin?.passwordHash ?? (await invalidPasswordHash()),
  );

  if (!admin || !passwordMatches) {
    throw AppError.unauthorized("Invalid email or password");
  }

  if (!admin.isActive) {
    throw AppError.forbidden("This account is disabled");
  }

  const lastLoginAt = new Date();

  await prisma.admin.update({
    where: { id: admin.id },
    data: { lastLoginAt },
  });

  const { passwordHash: _passwordHash, ...safeAdmin } = admin;

  return {
    token: generateAccessToken({
      sub: admin.id,
      email: admin.email,
      role: "ADMIN" satisfies AccountRole,
    }),
    user: {
      ...safeAdmin,
      lastLoginAt,
    },
  };
};

const tokenHashOf = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export const isTokenRevoked = async (token: string): Promise<boolean> => {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: tokenHashOf(token) },
    select: { revokedAt: true },
  });

  return record?.revokedAt != null;
};

const logout = async (auth: AuthContext, token: string): Promise<void> => {
  const decoded = jwt.decode(token);
  const expiresAt =
    decoded && typeof decoded === "object" && typeof decoded.exp === "number"
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.upsert({
    where: { tokenHash: tokenHashOf(token) },
    update: { revokedAt: new Date() },
    create: {
      tokenHash: tokenHashOf(token),
      userId: auth.role === "USER" ? auth.id : null,
      adminId: auth.role === "ADMIN" ? auth.id : null,
      expiresAt,
      revokedAt: new Date(),
    },
  });
};

const printAdminDetails = (admin: {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}): void => {
  console.log(`  name: ${admin.firstName} ${admin.lastName}`);
  console.log(`  email: ${admin.email}`);
  console.log(`  role: ${admin.role}`);
};

const ensureDefaultAdmin = async (): Promise<void> => {
  const existing = await prisma.admin.findUnique({
    where: { email: env.ADMIN_EMAIL },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      role: true,
    },
  });

  if (existing) {
    console.log("Admin already exists");
    printAdminDetails(existing);
    return;
  }

  const admin = await prisma.admin.create({
    data: {
      firstName: env.ADMIN_FIRST_NAME,
      lastName: env.ADMIN_LAST_NAME,
      email: env.ADMIN_EMAIL,
      passwordHash: await hashPassword(env.ADMIN_PASSWORD),
      role: "SUPER_ADMIN",
    },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      role: true,
    },
  });

  console.log("Default admin created");
  printAdminDetails(admin);
  console.log(`  password: ${env.ADMIN_PASSWORD}`);
};

export const authService = {
  login,
  loginAdmin,
  logout,
  ensureDefaultAdmin,
};
