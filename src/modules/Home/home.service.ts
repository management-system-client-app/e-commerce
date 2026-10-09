import { Prisma } from "../../../generated/prisma/client";
import {
  cacheGetOrSet,
  CATALOG_CACHE_TTL_SECONDS,
  invalidateCache,
} from "../../app/config/cache";
import { prisma } from "../../app/config/prisma";
import { AppError } from "../../app/errors/AppError";
import { NotFoundError } from "../../app/errors/NotFoundError";
import { withProductFlags } from "../Product/product.flags";
import type { CreateHomeBlockInput, UpdateHomeBlockInput } from "./home.validation";

const blockSelect = {
  id: true,
  kind: true,
  title: true,
  subtitle: true,
  imageUrl: true,
  productIds: true,
  linkUrl: true,
  categoryId: true,
  sortOrder: true,
  isActive: true,
  startsAt: true,
  endsAt: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
} satisfies Prisma.HomeBlockSelect;

const arrivalProductSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  gender: true,
  basePrice: true,
  compareAtPrice: true,
  createdAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  brand: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  images: {
    orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }],
    take: 1,
    select: {
      url: true,
      alt: true,
      isPrimary: true,
    },
  },
  variants: {
    where: { isActive: true },
    select: {
      stock: true,
      reserved: true,
      color: { select: { id: true, name: true, hexCode: true } },
    },
  },
} satisfies Prisma.ProductSelect;

const NEW_ARRIVAL_LIMIT = 8;

const assertCategory = async (categoryId: string | null | undefined): Promise<void> => {
  if (!categoryId) {
    return;
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });

  if (!category) {
    throw AppError.badRequest("Category not found");
  }
};

const toDate = (value: string | null | undefined): Date | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return new Date(value);
};

const loadArrivals = async (categoryId: string | null) => {
  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      ...(categoryId ? { categoryId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: NEW_ARRIVAL_LIMIT,
    select: arrivalProductSelect,
  });

  return products.map(withProductFlags);
};

const loadSelectedProducts = async (productIds: string[]) => {
  if (productIds.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: arrivalProductSelect,
  });
  const byId = new Map(products.map((product) => [product.id, withProductFlags(product)]));

  return productIds.flatMap((id) => {
    const product = byId.get(id);
    return product ? [product] : [];
  });
};

const getStorefront = async () => {
  return cacheGetOrSet("home", "storefront", CATALOG_CACHE_TTL_SECONDS, async () => {
    const now = new Date();
    const blocks = await prisma.homeBlock.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: blockSelect,
    });

    const banners = blocks.filter((block) => block.kind === "BANNER");
    const campaigns = blocks.filter((block) => block.kind === "CAMPAIGN");
    const newArrivals = await Promise.all(
      blocks
        .filter((block) => block.kind === "NEW_ARRIVAL")
        .map(async (block) => ({
          ...block,
          products: await loadArrivals(block.categoryId),
        })),
    );
    const trendingProductIds = [
      ...new Set(blocks.filter((block) => block.kind === "TRENDING").flatMap((block) => block.productIds)),
    ];
    const trendingProducts = (await loadSelectedProducts(trendingProductIds)).filter(
      (product) => product.status === "ACTIVE" && product.variants.some((variant) => variant.stock - variant.reserved > 0),
    );

    return { banners, campaigns, newArrivals, trendingProducts };
  });
};

const getBlocks = async () => {
  const blocks = await prisma.homeBlock.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: blockSelect,
  });

  return Promise.all(
    blocks.map(async (block) => ({
      ...block,
      ...(block.kind === "TRENDING" ? { products: await loadSelectedProducts(block.productIds) } : {}),
    })),
  );
};

const createBlock = async (input: CreateHomeBlockInput) => {
  await assertCategory(input.categoryId);

  const block = await prisma.homeBlock.create({
    data: {
      kind: input.kind,
      title: input.title,
      subtitle: input.subtitle,
      imageUrl: input.imageUrl,
      productIds: input.productIds ?? [],
      linkUrl: input.linkUrl,
      categoryId: input.categoryId,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
      startsAt: toDate(input.startsAt),
      endsAt: toDate(input.endsAt),
    },
    select: blockSelect,
  });

  await invalidateCache("home");
  return block;
};

const updateBlock = async (id: string, input: UpdateHomeBlockInput) => {
  const existing = await prisma.homeBlock.findUnique({
    where: { id },
    select: { id: true, kind: true, imageUrl: true, startsAt: true, endsAt: true },
  });

  if (!existing) {
    throw new NotFoundError("Home block not found");
  }

  const nextKind = input.kind ?? existing.kind;
  const nextImage = input.imageUrl === undefined ? existing.imageUrl : input.imageUrl;

  if (nextKind === "BANNER" && !nextImage) {
    throw AppError.badRequest("A banner needs an image");
  }

  const nextStart = input.startsAt === undefined ? existing.startsAt : toDate(input.startsAt);
  const nextEnd = input.endsAt === undefined ? existing.endsAt : toDate(input.endsAt);

  if (nextStart && nextEnd && nextEnd.getTime() <= nextStart.getTime()) {
    throw AppError.badRequest("endsAt must be after startsAt");
  }

  await assertCategory(input.categoryId);

  const block = await prisma.homeBlock.update({
    where: { id },
    data: {
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.subtitle !== undefined ? { subtitle: input.subtitle } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.productIds !== undefined ? { productIds: input.productIds } : {}),
      ...(input.linkUrl !== undefined ? { linkUrl: input.linkUrl } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.startsAt !== undefined ? { startsAt: toDate(input.startsAt) } : {}),
      ...(input.endsAt !== undefined ? { endsAt: toDate(input.endsAt) } : {}),
    },
    select: blockSelect,
  });

  await invalidateCache("home");
  return block;
};

const deleteBlock = async (id: string) => {
  try {
    await prisma.homeBlock.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("Home block not found");
    }

    throw error;
  }

  await invalidateCache("home");
};

export const homeService = {
  getStorefront,
  getBlocks,
  createBlock,
  updateBlock,
  deleteBlock,
};
