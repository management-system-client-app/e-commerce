import { Prisma } from "../../../generated/prisma/client";
import {
  cacheGetOrSet,
  CATALOG_CACHE_TTL_SECONDS,
  invalidateCache,
} from "../../app/config/cache";
import { prisma } from "../../app/config/prisma";
import { AppError } from "../../app/errors/AppError";
import type {
  CatalogListQuery,
  CreateFabricInput,
  CreateSizeInput,
} from "./catalog.validation";

const slugify = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);

const buildSlug = async (
  name: string,
  requestedSlug: string | undefined,
  label: string,
  findExisting: (slug: string) => Promise<{ id: string } | null>,
): Promise<string> => {
  const slug = slugify(requestedSlug ?? name);

  if (!slug) {
    throw AppError.badRequest(`${label} name cannot be turned into a slug`);
  }

  if (requestedSlug) {
    return slug;
  }

  const existing = await findExisting(slug);

  if (!existing) {
    return slug;
  }

  return `${slug.slice(0, 174)}-${Math.random().toString(36).slice(2, 6)}`;
};

const listMeta = (query: CatalogListQuery, total: number) => ({
  page: query.page,
  limit: query.limit,
  total,
  totalPages: Math.ceil(total / query.limit),
});

const rethrowDuplicate = (error: unknown, message: string): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw AppError.conflict(message);
  }

  throw error;
};

const createSize = async (input: CreateSizeInput) => {
  const slug = await buildSlug(input.name, input.slug, "Size", (slug) =>
    prisma.size.findUnique({ where: { slug }, select: { id: true } }),
  );

  try {
    const size = await prisma.size.create({
      data: {
        name: input.name,
        slug,
        sortOrder: input.sortOrder ?? 0,
      },
    });

    await invalidateCache("catalog", "products");
    return size;
  } catch (error) {
    throw rethrowDuplicate(error, "A size with this slug already exists");
  }
};

const getSizes = async (query: CatalogListQuery) => {
  const where: Prisma.SizeWhereInput = query.search
    ? { name: { contains: query.search, mode: "insensitive" } }
    : {};
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await prisma.$transaction([
    prisma.size.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.size.count({ where }),
  ]);

  return { items, meta: listMeta(query, total) };
};

const createFabric = async (input: CreateFabricInput) => {
  const slug = await buildSlug(input.name, input.slug, "Fabric", (slug) =>
    prisma.fabric.findUnique({ where: { slug }, select: { id: true } }),
  );

  try {
    const fabric = await prisma.fabric.create({
      data: {
        name: input.name,
        slug,
        composition: input.composition,
      },
    });

    await invalidateCache("catalog", "products");
    return fabric;
  } catch (error) {
    throw rethrowDuplicate(error, "A fabric with this slug already exists");
  }
};

const getFabrics = async (query: CatalogListQuery) => {
  const where: Prisma.FabricWhereInput = query.search
    ? { name: { contains: query.search, mode: "insensitive" } }
    : {};
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await prisma.$transaction([
    prisma.fabric.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { name: "asc" },
    }),
    prisma.fabric.count({ where }),
  ]);

  return { items, meta: listMeta(query, total) };
};

const getCatalog = async () => {
  return cacheGetOrSet("catalog", "storefront", CATALOG_CACHE_TTL_SECONDS, loadCatalog);
};

const loadCatalog = async () => {
  const [brands, categories, sizes, fabrics] = await Promise.all([
    prisma.brand.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, parentId: true },
    }),
    prisma.size.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, sortOrder: true },
    }),
    prisma.fabric.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, composition: true },
    }),
  ]);

  return { brands, categories, sizes, fabrics };
};

export const catalogService = {
  getCatalog,
  createSize,
  getSizes,
  createFabric,
  getFabrics,
};
