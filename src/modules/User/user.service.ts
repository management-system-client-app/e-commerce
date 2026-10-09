import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../app/config/prisma";
import { AppError } from "../../app/errors/AppError";
import { NotFoundError } from "../../app/errors/NotFoundError";
import type { AuthContext } from "../../app/middlewares/auth";
import { comparePassword, hashPassword } from "../../utils/bcrypt";
import type { RegisterUserInput, SaveAddressInput, UpdateProfileInput } from "./user.validation";

const publicUserSelect = {
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
} satisfies Prisma.UserSelect;

const publicAdminSelect = {
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
} satisfies Prisma.AdminSelect;

const createUser = async (input: RegisterUserInput) => {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existing) {
    throw AppError.conflict("An account with this email already exists");
  }

  const passwordHash = await hashPassword(input.password);

  try {
    return await prisma.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordHash,
        phone: input.phone,
        isEmailVerified: true,
      },
      select: publicUserSelect,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw AppError.conflict("An account with this email already exists");
    }

    throw error;
  }
};

const getUserById = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: publicUserSelect,
  });

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return user;
};

const getCurrentAccount = async (auth: AuthContext) => {
  if (auth.role === "ADMIN") {
    const admin = await prisma.admin.findUnique({
      where: { id: auth.id },
      select: publicAdminSelect,
    });

    if (!admin) {
      throw new NotFoundError("Account not found");
    }

    return {
      accountType: "ADMIN" as const,
      ...admin,
    };
  }

  const user = await getUserById(auth.id);

  return {
    accountType: "USER" as const,
    ...user,
  };
};

const updateProfile = async (auth: AuthContext, input: UpdateProfileInput) => {
  if (input.newPassword) {
    if (!input.currentPassword) {
      throw AppError.badRequest("Current password is required");
    }

    const account =
      auth.role === "ADMIN"
        ? await prisma.admin.findUnique({
            where: { id: auth.id },
            select: { passwordHash: true },
          })
        : await prisma.user.findUnique({
            where: { id: auth.id },
            select: { passwordHash: true },
          });

    if (!account) {
      throw new NotFoundError("Account not found");
    }

    const matches = await comparePassword(input.currentPassword, account.passwordHash);

    if (!matches) {
      throw AppError.unauthorized("Current password is incorrect");
    }
  }

  const passwordHash = input.newPassword ? await hashPassword(input.newPassword) : undefined;

  if (auth.role === "ADMIN") {
    if (input.phone !== undefined) {
      throw AppError.badRequest("Admins can update name, photo, and password only");
    }

    const admin = await prisma.admin.update({
      where: { id: auth.id },
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: publicAdminSelect,
    });

    return {
      accountType: "ADMIN" as const,
      ...admin,
    };
  }

  const user = await prisma.user.update({
    where: { id: auth.id },
    data: {
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      ...(passwordHash ? { passwordHash } : {}),
    },
    select: publicUserSelect,
  });

  return {
    accountType: "USER" as const,
    ...user,
  };
};

const addressSelect = {
  id: true,
  label: true,
  fullName: true,
  phone: true,
  line1: true,
  line2: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  isDefault: true,
} satisfies Prisma.AddressSelect;

const getDefaultAddress = (userId: string) =>
  prisma.address.findFirst({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: addressSelect,
  });

const saveDefaultAddress = (userId: string, input: SaveAddressInput) =>
  prisma.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      select: { id: true },
    });

    await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });

    const data = { ...input, label: input.label ?? "Home", isDefault: true };
    return existing
      ? tx.address.update({ where: { id: existing.id }, data, select: addressSelect })
      : tx.address.create({ data: { ...data, userId }, select: addressSelect });
  });

export const userService = {
  createUser,
  getUserById,
  getCurrentAccount,
  updateProfile,
  getDefaultAddress,
  saveDefaultAddress,
};
