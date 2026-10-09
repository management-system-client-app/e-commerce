import { createHash, randomInt } from "node:crypto";
import jwt from "jsonwebtoken";
import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../app/config/prisma";
import { AppError } from "../../app/errors/AppError";
import type { AuthContext } from "../../app/middlewares/auth";
import { comparePassword, hashPassword } from "../../utils/bcrypt";
import { generateAccessToken, type AccountRole } from "../../utils/generateToken";
import { env } from "../../app/config/env";
import { sendPasswordResetEmail } from "../../utils/emailSender";
import type { ForgotPasswordInput, LoginInput, ResetPasswordInput } from "./auth.validation";

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
  avatarUrl: true,
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

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

type ResetOwner = { userId: string; adminId?: never } | { adminId: string; userId?: never };

const resetCode = (): string => randomInt(0, 1_000_000).toString().padStart(6, "0");

const codeHashOf = (ownerId: string, code: string): string => tokenHashOf(`${ownerId}:${code}`);

const issuePasswordReset = async (
  email: string,
  owner: ResetOwner | null,
): Promise<{ code?: string }> => {
  if (!owner) {
    return {};
  }

  const code = resetCode();
  const ownerId = owner.userId ?? owner.adminId;
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  const ownerWhere = owner.userId ? { userId: owner.userId } : { adminId: owner.adminId };

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({
      where: { ...ownerWhere, usedAt: null },
    }),
    prisma.passwordResetToken.create({
      data: {
        tokenHash: codeHashOf(ownerId, code),
        expiresAt,
        ...ownerWhere,
      },
    }),
  ]);

  try {
    await sendPasswordResetEmail({
      to: email,
      code,
      expiresInMinutes: 30,
    });
    return {};
  } catch (error) {
    console.error(
      "Password reset email was not sent.",
      error instanceof Error ? error.message : error,
    );
    throw new AppError("Could not send the reset email", 503);
  }
};

const forgotPassword = async (input: ForgotPasswordInput): Promise<{ code?: string }> => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return issuePasswordReset(input.email, null);
  }

  return issuePasswordReset(input.email, { userId: user.id });
};

const forgotAdminPassword = async (
  input: ForgotPasswordInput,
): Promise<{ code?: string }> => {
  const admin = await prisma.admin.findUnique({
    where: { email: input.email },
    select: { id: true, isActive: true },
  });

  if (!admin || !admin.isActive) {
    return issuePasswordReset(input.email, null);
  }

  return issuePasswordReset(input.email, { adminId: admin.id });
};

const findResetOwner = async (
  email: string,
  code: string,
): Promise<{ userId: string } | { adminId: string } | null> => {
  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isActive: true },
  });

  if (user?.isActive) {
    const match = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        tokenHash: codeHashOf(user.id, code),
        usedAt: null,
        expiresAt: { gt: now },
      },
      select: { id: true },
    });

    if (match) {
      return { userId: user.id };
    }
  }

  const admin = await prisma.admin.findUnique({
    where: { email },
    select: { id: true, isActive: true },
  });

  if (!admin?.isActive) {
    return null;
  }

  const match = await prisma.passwordResetToken.findFirst({
    where: {
      adminId: admin.id,
      tokenHash: codeHashOf(admin.id, code),
      usedAt: null,
      expiresAt: { gt: now },
    },
    select: { id: true },
  });

  return match ? { adminId: admin.id } : null;
};

const verifyResetCode = async (input: { email: string; code: string }): Promise<void> => {
  const owner = await findResetOwner(input.email, input.code);

  if (!owner) {
    throw AppError.badRequest("Reset code is invalid or has expired");
  }
};

const resetPassword = async (input: ResetPasswordInput): Promise<void> => {
  const owner = await findResetOwner(input.email, input.code);

  if (!owner) {
    throw AppError.badRequest("Reset code is invalid or has expired");
  }

  const passwordHash = await hashPassword(input.password);
  const usedAt = new Date();

  if ("userId" in owner) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: owner.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.updateMany({
        where: { userId: owner.userId, usedAt: null },
        data: { usedAt },
      }),
    ]);
    return;
  }

  await prisma.$transaction([
    prisma.admin.update({
      where: { id: owner.adminId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.updateMany({
      where: { adminId: owner.adminId, usedAt: null },
      data: { usedAt },
    }),
  ]);
};

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

  try {
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      console.log("Admin already exists");
      return;
    }

    throw error;
  }
};

export const authService = {
  login,
  loginAdmin,
  logout,
  forgotPassword,
  forgotAdminPassword,
  verifyResetCode,
  resetPassword,
  ensureDefaultAdmin,
};
