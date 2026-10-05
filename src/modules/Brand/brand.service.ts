import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../app/config/prisma";
import { AppError } from "../../app/errors/AppError";
import type { BrandListQuery, CreateBrandInput } from "./brand.validation";

const brandSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  logoUrl: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BrandSelect;

const slugify = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);

const buildSlug = async (name: string, requestedSlug?: string): Promise<string> => {
  const slug = slugify(requestedSlug ?? name);

  if (!slug) {
    throw AppError.badRequest("Brand name cannot be turned into a slug");
  }

  if (requestedSlug) {
    return slug;
  }

  const existing = await prisma.brand.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!existing) {
    return slug;
  }

  return `${slug.slice(0, 174)}-${Math.random().toString(36).slice(2, 6)}`;
};

const createBrand = async (input: CreateBrandInput) => {
  const slug = await buildSlug(input.name, input.slug);

  try {
    return await prisma.brand.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        logoUrl: input.logoUrl,
        isActive: input.isActive ?? true,
      },
      select: brandSelect,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw AppError.conflict("A brand with this slug already exists");
    }

    throw error;
  }
};

const getBrands = async (query: BrandListQuery) => {
  const where: Prisma.BrandWhereInput = {
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
  };
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await prisma.$transaction([
    prisma.brand.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { name: "asc" },
      select: brandSelect,
    }),
    prisma.brand.count({ where }),
  ]);

  return {
    items,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const brandService = {
  createBrand,
  getBrands,
};
