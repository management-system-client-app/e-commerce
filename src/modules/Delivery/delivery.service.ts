import { Prisma } from "../../../generated/prisma/client";
import {
  cacheGetOrSet,
  CATALOG_CACHE_TTL_SECONDS,
  invalidateCache,
} from "../../app/config/cache";
import { prisma } from "../../app/config/prisma";
import { AppError } from "../../app/errors/AppError";
import { NotFoundError } from "../../app/errors/NotFoundError";
import type { CreateDeliveryZoneInput, UpdateDeliveryZoneInput } from "./delivery.validation";

const zoneSelect = {
  id: true,
  name: true,
  city: true,
  fee: true,
  freeShippingOver: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DeliveryZoneSelect;

type ZoneQuote = {
  id: string;
  name: string;
  city: string | null;
  fee: Prisma.Decimal | number;
  freeShippingOver: Prisma.Decimal | number | null;
};

const cityKey = (city: string | null | undefined): string | null => {
  const value = city?.trim().toLowerCase();
  return value ? value : null;
};

export const resolveShipping = (zones: ZoneQuote[], city: string, subtotal: number) => {
  const key = cityKey(city);
  const match =
    zones.find((zone) => cityKey(zone.city) === key && key !== null) ??
    zones.find((zone) => cityKey(zone.city) === null);

  if (!match) {
    return { fee: 0, zoneId: null as string | null, zoneName: null as string | null };
  }

  const threshold = match.freeShippingOver == null ? null : Number(match.freeShippingOver);
  const fee = threshold != null && subtotal >= threshold ? 0 : Number(match.fee);

  return { fee, zoneId: match.id, zoneName: match.name };
};

const assertUniqueCity = async (city: string | null | undefined, ignoreId?: string) => {
  const key = cityKey(city);
  const zones = await prisma.deliveryZone.findMany({
    where: ignoreId ? { id: { not: ignoreId } } : undefined,
    select: { id: true, city: true },
  });

  if (zones.some((zone) => cityKey(zone.city) === key)) {
    throw AppError.conflict(key ? "A delivery zone for this city already exists" : "A default delivery zone already exists");
  }
};

const getZones = async () => {
  return cacheGetOrSet("content", "delivery-zones", CATALOG_CACHE_TTL_SECONDS, () =>
    prisma.deliveryZone.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: zoneSelect,
    }),
  );
};

const getAllZones = async () => {
  return prisma.deliveryZone.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: zoneSelect,
  });
};

const quote = async (city: string, subtotal: number) => {
  const zones = await prisma.deliveryZone.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: zoneSelect,
  });
  const shipping = resolveShipping(zones, city, subtotal);

  return {
    city,
    subtotal,
    shippingAmount: shipping.fee,
    zoneId: shipping.zoneId,
    zoneName: shipping.zoneName,
  };
};

const createZone = async (input: CreateDeliveryZoneInput) => {
  await assertUniqueCity(input.city);

  const zone = await prisma.deliveryZone.create({
    data: {
      name: input.name,
      city: cityKey(input.city) ? input.city?.trim() : null,
      fee: input.fee,
      freeShippingOver: input.freeShippingOver,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    },
    select: zoneSelect,
  });

  await invalidateCache("content");
  return zone;
};

const updateZone = async (id: string, input: UpdateDeliveryZoneInput) => {
  const existing = await prisma.deliveryZone.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new NotFoundError("Delivery zone not found");
  }

  if (input.city !== undefined) {
    await assertUniqueCity(input.city, id);
  }

  const zone = await prisma.deliveryZone.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.city !== undefined ? { city: cityKey(input.city) ? input.city?.trim() : null } : {}),
      ...(input.fee !== undefined ? { fee: input.fee } : {}),
      ...(input.freeShippingOver !== undefined ? { freeShippingOver: input.freeShippingOver } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
    select: zoneSelect,
  });

  await invalidateCache("content");
  return zone;
};

const deleteZone = async (id: string) => {
  try {
    await prisma.deliveryZone.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("Delivery zone not found");
    }

    throw error;
  }

  await invalidateCache("content");
};

export const deliveryService = {
  getZones,
  getAllZones,
  quote,
  createZone,
  updateZone,
  deleteZone,
};
