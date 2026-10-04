import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../app/config/prisma";
import { AppError } from "../../app/errors/AppError";
import { NotFoundError } from "../../app/errors/NotFoundError";
import type { AuthContext } from "../../app/middlewares/auth";
import { hashPassword } from "../../utils/bcrypt";
import type { RegisterUserInput } from "./user.validation";

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

export const userService = {
  createUser,
  getUserById,
  getCurrentAccount,
};
