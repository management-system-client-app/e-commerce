import { Prisma } from "../../../generated/prisma/client";
import {
  cacheGetOrSet,
  CATALOG_CACHE_TTL_SECONDS,
  invalidateCache,
} from "../../app/config/cache";
import { prisma } from "../../app/config/prisma";
import { NotFoundError } from "../../app/errors/NotFoundError";
import type { UpsertPageInput } from "./page.validation";

const pageSelect = {
  id: true,
  slug: true,
  title: true,
  body: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ContentPageSelect;

const getPages = async () => {
  return cacheGetOrSet("content", "pages", CATALOG_CACHE_TTL_SECONDS, () =>
    prisma.contentPage.findMany({
      where: { isActive: true },
      orderBy: { title: "asc" },
      select: {
        slug: true,
        title: true,
        updatedAt: true,
      },
    }),
  );
};

const getPage = async (slug: string) => {
  return cacheGetOrSet("content", `page:${slug}`, CATALOG_CACHE_TTL_SECONDS, async () => {
    const page = await prisma.contentPage.findUnique({
      where: { slug },
      select: pageSelect,
    });

    if (!page || !page.isActive) {
      throw new NotFoundError("Page not found");
    }

    return page;
  });
};

const getAllPages = async () => {
  return prisma.contentPage.findMany({
    orderBy: { title: "asc" },
    select: pageSelect,
  });
};

const upsertPage = async (slug: string, input: UpsertPageInput) => {
  const page = await prisma.contentPage.upsert({
    where: { slug },
    update: {
      title: input.title,
      body: input.body,
      isActive: input.isActive ?? true,
    },
    create: {
      slug,
      title: input.title,
      body: input.body,
      isActive: input.isActive ?? true,
    },
    select: pageSelect,
  });

  await invalidateCache("content");
  return page;
};

const deletePage = async (slug: string) => {
  try {
    await prisma.contentPage.delete({ where: { slug } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("Page not found");
    }

    throw error;
  }

  await invalidateCache("content");
};

export const pageService = {
  getPages,
  getPage,
  getAllPages,
  upsertPage,
  deletePage,
};
