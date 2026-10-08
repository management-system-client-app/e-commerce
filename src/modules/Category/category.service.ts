import { Prisma } from "../../../generated/prisma/client";
import {
  cacheGetOrSet,
  cacheKey,
  CATALOG_CACHE_TTL_SECONDS,
  invalidateCache,
} from "../../app/config/cache";
import { prisma } from "../../app/config/prisma";
import { AppError } from "../../app/errors/AppError";
import { NotFoundError } from "../../app/errors/NotFoundError";
import type { CategoryListQuery, CreateCategoryInput, UpdateCategoryInput } from "./category.validation";

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  parentId: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CategorySelect;

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
    throw AppError.badRequest("Category name cannot be turned into a slug");
  }

  if (requestedSlug) {
    return slug;
  }

  const existing = await prisma.category.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!existing) {
    return slug;
  }

  return `${slug.slice(0, 174)}-${Math.random().toString(36).slice(2, 6)}`;
};

const createCategory = async (input: CreateCategoryInput) => {
  if (input.parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: input.parentId },
      select: { id: true },
    });

    if (!parent) {
      throw new NotFoundError("Parent category not found");
    }
  }

  const slug = await buildSlug(input.name, input.slug);

  try {
    const category = await prisma.category.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        imageUrl: input.imageUrl,
        parentId: input.parentId,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
      select: categorySelect,
    });

    await invalidateCache("catalog", "products", "home");
    return category;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw AppError.conflict("A category with this slug already exists");
    }

    throw error;
  }
};

const updateCategory = async (id: string, input: UpdateCategoryInput) => {
  const existing = await prisma.category.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new NotFoundError("Category not found");
  }

  if (input.parentId === id) {
    throw AppError.badRequest("A category cannot be its own parent");
  }

  if (input.parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: input.parentId },
      select: { id: true },
    });

    if (!parent) {
      throw new NotFoundError("Parent category not found");
    }
  }

  try {
    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
      select: categorySelect,
    });

    await invalidateCache("catalog", "products", "home");
    return category;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw AppError.conflict("A category with this slug already exists");
    }

    throw error;
  }
};

const deleteCategory = async (id: string) => {
  const existing = await prisma.category.findUnique({
    where: { id },
    select: {
      id: true,
      _count: { select: { products: true, children: true } },
    },
  });

  if (!existing) {
    throw new NotFoundError("Category not found");
  }

  if (existing._count.products > 0) {
    throw AppError.conflict("Move products out of this category before deleting it");
  }

  if (existing._count.children > 0) {
    throw AppError.conflict("Remove child categories before deleting this one");
  }

  await prisma.category.delete({ where: { id } });
  await invalidateCache("catalog", "products", "home");
};

const loadCategories = async (query: CategoryListQuery) => {
  const where: Prisma.CategoryWhereInput = {
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.parentId ? { parentId: query.parentId } : {}),
    ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
  };
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await prisma.$transaction([
    prisma.category.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: categorySelect,
    }),
    prisma.category.count({ where }),
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

const getCategories = async (query: CategoryListQuery) => {
  if (query.search) {
    return loadCategories(query);
  }

  return cacheGetOrSet(
    "catalog",
    `categories:${cacheKey(query)}`,
    CATALOG_CACHE_TTL_SECONDS,
    () => loadCategories(query),
  );
};

export const categoryService = {
  createCategory,
  updateCategory,
  deleteCategory,
  getCategories,
};
