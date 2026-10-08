import { Prisma } from "../../../generated/prisma/client";
import {
  cacheGetOrSet,
  CATALOG_CACHE_TTL_SECONDS,
  invalidateCache,
} from "../../app/config/cache";
import { prisma } from "../../app/config/prisma";
import { NotFoundError } from "../../app/errors/NotFoundError";
import type { CreateOutletInput, UpdateOutletInput } from "./outlet.validation";

const outletSelect = {
  id: true,
  name: true,
  address: true,
  city: true,
  phone: true,
  hours: true,
  mapUrl: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OutletSelect;

const getOutlets = async () => {
  return cacheGetOrSet("content", "outlets", CATALOG_CACHE_TTL_SECONDS, () =>
    prisma.outlet.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: outletSelect,
    }),
  );
};

const getAllOutlets = async () => {
  return prisma.outlet.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: outletSelect,
  });
};

const createOutlet = async (input: CreateOutletInput) => {
  const outlet = await prisma.outlet.create({
    data: {
      name: input.name,
      address: input.address,
      city: input.city,
      phone: input.phone,
      hours: input.hours,
      mapUrl: input.mapUrl,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    },
    select: outletSelect,
  });

  await invalidateCache("content");
  return outlet;
};

const updateOutlet = async (id: string, input: UpdateOutletInput) => {
  try {
    const outlet = await prisma.outlet.update({
      where: { id },
      data: input,
      select: outletSelect,
    });

    await invalidateCache("content");
    return outlet;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("Outlet not found");
    }

    throw error;
  }
};

const deleteOutlet = async (id: string) => {
  try {
    await prisma.outlet.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("Outlet not found");
    }

    throw error;
  }

  await invalidateCache("content");
};

export const outletService = {
  getOutlets,
  getAllOutlets,
  createOutlet,
  updateOutlet,
  deleteOutlet,
};
