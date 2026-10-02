import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../app/config/prisma";
import { AppError } from "../../app/errors/AppError";
import { NotFoundError } from "../../app/errors/NotFoundError";
import type {
  CreateProductInput,
  ProductListQuery,
  UpdateProductInput,
} from "./product.validation";

const productListInclude = {
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
  _count: {
    select: {
      variants: true,
    },
  },
} satisfies Prisma.ProductInclude;

const productDetailInclude = {
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
    },
  },
  brand: {
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
    },
  },
  images: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      url: true,
      alt: true,
      sortOrder: true,
      isPrimary: true,
      colorId: true,
    },
  },
  variants: {
    orderBy: [{ size: { sortOrder: "asc" as const } }, { color: { name: "asc" as const } }],
    include: {
      size: { select: { id: true, name: true, slug: true, sortOrder: true } },
      color: { select: { id: true, name: true, slug: true, hexCode: true } },
      fabric: { select: { id: true, name: true, slug: true, composition: true } },
    },
  },
} satisfies Prisma.ProductInclude;

const slugify = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);

const rethrowWriteError = (error: unknown, duplicateMessage: string): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw AppError.conflict(duplicateMessage);
  }

  throw error;
};

const assertCategoryAndBrand = async (
  categoryId?: string,
  brandId?: string,
): Promise<void> => {
  const [category, brand] = await Promise.all([
    categoryId
      ? prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } })
      : Promise.resolve(undefined),
    brandId
      ? prisma.brand.findUnique({ where: { id: brandId }, select: { id: true } })
      : Promise.resolve(undefined),
  ]);

  if (categoryId && !category) {
    throw new NotFoundError("Category not found");
  }

  if (brandId && !brand) {
    throw new NotFoundError("Brand not found");
  }
};

const buildSlug = async (name: string, requestedSlug?: string): Promise<string> => {
  const slug = slugify(requestedSlug ?? name);

  if (!slug) {
    throw AppError.badRequest("Product name cannot be turned into a slug");
  }

  if (requestedSlug) {
    return slug;
  }

  const existing = await prisma.product.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!existing) {
    return slug;
  }

  return `${slug.slice(0, 174)}-${Math.random().toString(36).slice(2, 6)}`;
};

const createProduct = async (
  input: CreateProductInput,
  images: { url: string; alt: string }[] = [],
) => {
  await assertCategoryAndBrand(input.categoryId, input.brandId);
  const slug = await buildSlug(input.name, input.slug);

  try {
    return await prisma.product.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        status: input.status ?? "DRAFT",
        gender: input.gender,
        fit: input.fit,
        careInstructions: input.careInstructions,
        basePrice: input.basePrice,
        compareAtPrice: input.compareAtPrice,
        brandId: input.brandId,
        categoryId: input.categoryId,
        tags: input.tags ?? [],
        metaTitle: input.metaTitle,
        metaDescription: input.metaDescription,
        publishedAt:
          (input.status ?? "DRAFT") === "ACTIVE" ? new Date() : undefined,
        ...(images.length > 0
          ? {
              images: {
                create: images.map((image, index) => ({
                  url: image.url,
                  alt: image.alt,
                  sortOrder: index,
                  isPrimary: index === 0,
                })),
              },
            }
          : {}),
      },
      include: productDetailInclude,
    });
  } catch (error) {
    return rethrowWriteError(error, "A product with this slug already exists");
  }
};

const getAllProducts = async (query: ProductListQuery) => {
  const where: Prisma.ProductWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.gender ? { gender: query.gender } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.brandId ? { brandId: query.brandId } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { slug: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const skip = (query.page - 1) * query.limit;

  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { createdAt: "desc" },
      include: productListInclude,
    }),
    prisma.product.count({ where }),
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

const getSingleProduct = async (id: string) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: productDetailInclude,
  });

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  return product;
};

const updateProduct = async (id: string, input: UpdateProductInput) => {
  const existing = await prisma.product.findUnique({
    where: { id },
    select: { id: true, basePrice: true, publishedAt: true, status: true },
  });

  if (!existing) {
    throw new NotFoundError("Product not found");
  }

  await assertCategoryAndBrand(input.categoryId, input.brandId);

  const nextBasePrice = input.basePrice ?? Number(existing.basePrice);
  if (input.compareAtPrice != null && input.compareAtPrice <= nextBasePrice) {
    throw AppError.badRequest("compareAtPrice must be greater than basePrice");
  }

  const data: Prisma.ProductUncheckedUpdateInput = { ...input };

  if (input.status === "ACTIVE" && !existing.publishedAt) {
    data.publishedAt = new Date();
  }

  try {
    return await prisma.product.update({
      where: { id },
      data,
      include: productDetailInclude,
    });
  } catch (error) {
    return rethrowWriteError(error, "A product with this slug already exists");
  }
};

const deleteProduct = async (id: string) => {
  const existing = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      variants: {
        select: {
          id: true,
          _count: {
            select: { orderItems: true, exchanges: true },
          },
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError("Product not found");
  }

  const usedVariant = existing.variants.find(
    (variant) => variant._count.orderItems > 0 || variant._count.exchanges > 0,
  );

  if (usedVariant) {
    throw AppError.conflict(
      "This product is on an order or exchange. Deactivate it instead of deleting it",
    );
  }

  const variantIds = existing.variants.map((variant) => variant.id);

  await prisma.$transaction(async (tx) => {
    if (variantIds.length > 0) {
      await tx.cartItem.deleteMany({ where: { variantId: { in: variantIds } } });
      await tx.productVariant.deleteMany({ where: { id: { in: variantIds } } });
    }

    await tx.product.delete({ where: { id } });
  });
};

export const productService = {
  createProduct,
  getAllProducts,
  getSingleProduct,
  updateProduct,
  deleteProduct,
};
