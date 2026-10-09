import { Prisma } from "../../../generated/prisma/client";
import {
  cacheGetOrSet,
  cacheKey,
  invalidateCache,
  PRODUCT_CACHE_TTL_SECONDS,
} from "../../app/config/cache";
import { prisma } from "../../app/config/prisma";
import { AppError } from "../../app/errors/AppError";
import { NotFoundError } from "../../app/errors/NotFoundError";
import { withProductFlags } from "./product.flags";
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
    orderBy: [{ size: { sortOrder: "asc" as const } }, { sku: "asc" as const }],
    select: {
      id: true,
      sku: true,
      price: true,
      stock: true,
      reserved: true,
      size: { select: { id: true, name: true } },
      color: { select: { id: true, name: true, hexCode: true } },
      fabric: { select: { id: true, name: true } },
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
    const target = error.meta?.target;
    const fields = Array.isArray(target) ? target.join(", ") : String(target ?? "");

    if (fields.includes("sku")) {
      throw AppError.conflict("A size with this SKU already exists");
    }

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

const skuPart = (value: string): string =>
  value.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 8) || "ITEM";

const buildSku = (slug: string, sizeName: string, fabricName: string): string => {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${skuPart(slug)}-${skuPart(sizeName)}-${skuPart(fabricName)}-${suffix}`.slice(0, 64);
};

const loadSizes = async (sizes: NonNullable<CreateProductInput["sizes"]>) => {
  const sizeIds = [...new Set(sizes.map((size) => size.sizeId))];
  const fabricIds = [...new Set(sizes.map((size) => size.fabricId))];
  const [foundSizes, foundFabrics] = await Promise.all([
    prisma.size.findMany({
      where: { id: { in: sizeIds } },
      select: { id: true, name: true },
    }),
    prisma.fabric.findMany({
      where: { id: { in: fabricIds } },
      select: { id: true, name: true },
    }),
  ]);

  if (foundSizes.length !== sizeIds.length) {
    throw new NotFoundError("Size not found");
  }

  if (foundFabrics.length !== fabricIds.length) {
    throw new NotFoundError("Fabric not found");
  }

  return {
    sizeNames: new Map(foundSizes.map((size) => [size.id, size.name])),
    fabricNames: new Map(foundFabrics.map((fabric) => [fabric.id, fabric.name])),
  };
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
  const sizeCatalog = input.sizes?.length ? await loadSizes(input.sizes) : undefined;

  try {
    const product = await prisma.product.create({
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
        ...(input.sizes?.length
          ? {
              variants: {
                create: input.sizes.map((size) => ({
                  sizeId: size.sizeId,
                  fabricId: size.fabricId,
                  stock: size.stock,
                  price: size.price,
                  sku:
                    size.sku ??
                    buildSku(
                      slug,
                      sizeCatalog?.sizeNames.get(size.sizeId) ?? "SIZE",
                      sizeCatalog?.fabricNames.get(size.fabricId) ?? "FABRIC",
                    ),
                })),
              },
            }
          : {}),
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

    await invalidateCache("products", "home");
    return product;
  } catch (error) {
    return rethrowWriteError(error, "A product with this slug already exists");
  }
};

const productOrderBy = (
  sort: ProductListQuery["sort"],
): Prisma.ProductOrderByWithRelationInput => {
  if (sort === "price_asc") {
    return { basePrice: "asc" };
  }

  if (sort === "price_desc") {
    return { basePrice: "desc" };
  }

  if (sort === "name_asc") {
    return { name: "asc" };
  }

  return { createdAt: "desc" };
};

const loadProducts = async (query: ProductListQuery) => {
  const where: Prisma.ProductWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.gender ? { gender: query.gender } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.brandId ? { brandId: query.brandId } : {}),
    ...(query.sizeId || query.colorId || query.fabricId || query.inStock != null
      ? query.inStock === false
        ? {
            AND: [
              {
                variants: {
                  some: {
                    isActive: true,
                    ...(query.sizeId ? { sizeId: query.sizeId } : {}),
                    ...(query.colorId ? { colorId: query.colorId } : {}),
                    ...(query.fabricId ? { fabricId: query.fabricId } : {}),
                  },
                },
              },
              {
                variants: {
                  none: {
                    isActive: true,
                    stock: { gt: 0 },
                    ...(query.sizeId ? { sizeId: query.sizeId } : {}),
                    ...(query.colorId ? { colorId: query.colorId } : {}),
                    ...(query.fabricId ? { fabricId: query.fabricId } : {}),
                  },
                },
              },
            ],
          }
        : {
            variants: {
              some: {
                isActive: true,
                ...(query.inStock ? { stock: { gt: 0 } } : {}),
                ...(query.sizeId ? { sizeId: query.sizeId } : {}),
                ...(query.colorId ? { colorId: query.colorId } : {}),
                ...(query.fabricId ? { fabricId: query.fabricId } : {}),
              },
            },
          }
      : {}),
    ...(query.minPrice != null || query.maxPrice != null
      ? {
          basePrice: {
            ...(query.minPrice != null ? { gte: query.minPrice } : {}),
            ...(query.maxPrice != null ? { lte: query.maxPrice } : {}),
          },
        }
      : {}),
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
      orderBy: productOrderBy(query.sort),
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

const getAllProducts = async (query: ProductListQuery) => {
  const result = query.search
    ? await loadProducts(query)
    : await cacheGetOrSet(
        "products",
        `list:${cacheKey(query)}`,
        PRODUCT_CACHE_TTL_SECONDS,
        () => loadProducts(query),
      );

  return {
    ...result,
    items: result.items.map(withProductFlags),
  };
};

const relatedProductSelect = {
  id: true,
  name: true,
  slug: true,
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

const getBestSellers = async () => {
  const products = await cacheGetOrSet(
    "products",
    "best-sellers",
    PRODUCT_CACHE_TTL_SECONDS,
    async () => {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT p.id
        FROM "OrderItem" oi
        INNER JOIN "Order" o ON o.id = oi."orderId"
        INNER JOIN "ProductVariant" v ON v.id = oi."variantId"
        INNER JOIN "Product" p ON p.id = v."productId"
        WHERE o.status IN ('CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED')
          AND p.status = 'ACTIVE'
        GROUP BY p.id
        ORDER BY SUM(oi.quantity) DESC
        LIMIT 8
      `);

      if (rows.length === 0) {
        return [];
      }

      const found = await prisma.product.findMany({
        where: { id: { in: rows.map((row) => row.id) } },
        select: relatedProductSelect,
      });
      const byId = new Map(found.map((product) => [product.id, product]));

      return rows.flatMap((row) => {
        const product = byId.get(row.id);
        return product ? [product] : [];
      });
    },
  );

  return products.map(withProductFlags);
};

const getRelatedProducts = async (id: string) => {
  const products = await cacheGetOrSet("products", `related:${id}`, PRODUCT_CACHE_TTL_SECONDS, async () => {
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, categoryId: true },
    });

    if (!product) {
      throw new NotFoundError("Product not found");
    }

    return prisma.product.findMany({
      where: {
        categoryId: product.categoryId,
        id: { not: id },
        status: "ACTIVE",
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: relatedProductSelect,
    });
  });

  return products.map(withProductFlags);
};

const getSingleProduct = async (id: string) => {
  const product = await cacheGetOrSet("products", `id:${id}`, PRODUCT_CACHE_TTL_SECONDS, async () => {
    const found = await prisma.product.findUnique({
      where: { id },
      include: productDetailInclude,
    });

    if (!found) {
      throw new NotFoundError("Product not found");
    }

    return found;
  });

  return withProductFlags(product);
};

const updateProduct = async (
  id: string,
  input: UpdateProductInput,
  images: { url: string; alt: string }[] = [],
) => {
  const existing = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      basePrice: true,
      publishedAt: true,
      status: true,
      images: { select: { sortOrder: true } },
    },
  });

  if (!existing) {
    throw new NotFoundError("Product not found");
  }

  if (existing.images.length + images.length > 6) {
    throw AppError.badRequest("A product can have up to 6 images");
  }

  await assertCategoryAndBrand(input.categoryId, input.brandId);

  const nextBasePrice = input.basePrice ?? Number(existing.basePrice);
  if (input.compareAtPrice != null && input.compareAtPrice <= nextBasePrice) {
    throw AppError.badRequest("compareAtPrice must be greater than basePrice");
  }

  const data: Prisma.ProductUncheckedUpdateInput = { ...input };
  if (images.length > 0) {
    data.images = {
      create: images.map((image, index) => ({
        url: image.url,
        alt: image.alt,
        sortOrder: existing.images.length + index,
        isPrimary: existing.images.length === 0 && index === 0,
      })),
    };
  }

  if (input.status === "ACTIVE" && !existing.publishedAt) {
    data.publishedAt = new Date();
  }

  try {
    const product = await prisma.product.update({
      where: { id },
      data,
      include: productDetailInclude,
    });

    await invalidateCache("products", "home");
    return product;
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
    const variantIds = existing.variants.map((variant) => variant.id);
    await prisma.$transaction(async (tx) => {
      if (variantIds.length > 0) {
        await tx.cartItem.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.productVariant.updateMany({ where: { id: { in: variantIds } }, data: { isActive: false } });
      }
      await tx.product.update({ where: { id }, data: { status: "ARCHIVED" } });
    });
    await invalidateCache("products", "home");
    return { archived: true as const };
  }

  const variantIds = existing.variants.map((variant) => variant.id);

  await prisma.$transaction(async (tx) => {
    if (variantIds.length > 0) {
      await tx.cartItem.deleteMany({ where: { variantId: { in: variantIds } } });
      await tx.productVariant.deleteMany({ where: { id: { in: variantIds } } });
    }

    await tx.product.delete({ where: { id } });
  });

  await invalidateCache("products", "home");
  return { archived: false as const };
};

export const productService = {
  createProduct,
  getAllProducts,
  getBestSellers,
  getRelatedProducts,
  getSingleProduct,
  updateProduct,
  deleteProduct,
};
