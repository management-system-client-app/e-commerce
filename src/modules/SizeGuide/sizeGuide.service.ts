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
import type {
  CreateSizeGuideInput,
  SizeGuideListQuery,
  UpdateSizeGuideInput,
} from "./sizeGuide.validation";

const guideSelect = {
  id: true,
  title: true,
  columns: true,
  rows: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
} satisfies Prisma.SizeGuideSelect;

const assertCategory = async (categoryId: string): Promise<void> => {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });

  if (!category) {
    throw AppError.badRequest("Category not found");
  }
};

const asRows = (value: Prisma.JsonValue): string[][] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((row): row is string[] => Array.isArray(row)).map((row) => row.map(String));
};

const assertChart = (columns: string[], rows: string[][]): void => {
  const mismatch = rows.some((row) => row.length !== columns.length);

  if (mismatch) {
    throw AppError.badRequest("Each row must have one cell for every column");
  }
};

const getGuides = async (query: SizeGuideListQuery) => {
  return cacheGetOrSet("content", `size-guides:${cacheKey(query)}`, CATALOG_CACHE_TTL_SECONDS, () =>
    prisma.sizeGuide.findMany({
      where: {
        isActive: true,
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      },
      orderBy: { title: "asc" },
      select: guideSelect,
    }),
  );
};

const getAllGuides = async () => {
  return prisma.sizeGuide.findMany({
    orderBy: { title: "asc" },
    select: guideSelect,
  });
};

const createGuide = async (input: CreateSizeGuideInput) => {
  await assertCategory(input.categoryId);

  const guide = await prisma.sizeGuide.create({
    data: {
      categoryId: input.categoryId,
      title: input.title,
      columns: input.columns,
      rows: input.rows,
      isActive: input.isActive ?? true,
    },
    select: guideSelect,
  });

  await invalidateCache("content");
  return guide;
};

const updateGuide = async (id: string, input: UpdateSizeGuideInput) => {
  const existing = await prisma.sizeGuide.findUnique({
    where: { id },
    select: { id: true, columns: true, rows: true },
  });

  if (!existing) {
    throw new NotFoundError("Size guide not found");
  }

  if (input.categoryId) {
    await assertCategory(input.categoryId);
  }

  const columns = input.columns ?? existing.columns;
  const rows = input.rows ?? asRows(existing.rows);
  assertChart(columns, rows);

  const guide = await prisma.sizeGuide.update({
    where: { id },
    data: {
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.columns !== undefined ? { columns: input.columns } : {}),
      ...(input.rows !== undefined ? { rows: input.rows } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    select: guideSelect,
  });

  await invalidateCache("content");
  return guide;
};

const deleteGuide = async (id: string) => {
  try {
    await prisma.sizeGuide.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("Size guide not found");
    }

    throw error;
  }

  await invalidateCache("content");
};

export const sizeGuideService = {
  getGuides,
  getAllGuides,
  createGuide,
  updateGuide,
  deleteGuide,
};
