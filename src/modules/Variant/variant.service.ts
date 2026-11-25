import { Prisma } from "../../../generated/prisma/client";
import { invalidateCache } from "../../app/config/cache";
import { prisma } from "../../app/config/prisma";
import { AppError } from "../../app/errors/AppError";
import { NotFoundError } from "../../app/errors/NotFoundError";
import type {
  CreateVariantInput,
  UpdateVariantInput,
  VariantListQuery,
} from "./variant.validation";

const variantInclude = {
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  size: {
    select: {
      id: true,
      name: true,
      slug: true,
      sortOrder: true,
    },
  },
  color: {
    select: {
      id: true,
      name: true,
      slug: true,
      hexCode: true,
    },
  },
  fabric: {
    select: {
      id: true,
      name: true,
      slug: true,
      composition: true,
    },
  },
} satisfies Prisma.ProductVariantInclude;

const rethrowWriteError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = error.meta?.target;
    const fields = Array.isArray(target) ? target.join(", ") : "";

    if (fields.includes("sku")) {
      throw AppError.conflict("A variant with this SKU already exists");
    }

    if (fields.includes("barcode")) {
      throw AppError.conflict("A variant with this barcode already exists");
    }

    throw AppError.conflict(
      "This size, color, and fabric combination already exists for the product",
    );
  }

  throw error;
};

const assertRelations = async (input: {
  productId?: string;
  sizeId?: string;
  colorId?: string;
  fabricId?: string;
}): Promise<void> => {
  const [product, size, color, fabric] = await Promise.all([
    input.productId
      ? prisma.product.findUnique({ where: { id: input.productId }, select: { id: true } })
      : Promise.resolve(undefined),
    input.sizeId
      ? prisma.size.findUnique({ where: { id: input.sizeId }, select: { id: true } })
      : Promise.resolve(undefined),
    input.colorId
      ? prisma.color.findUnique({ where: { id: input.colorId }, select: { id: true } })
      : Promise.resolve(undefined),
    input.fabricId
      ? prisma.fabric.findUnique({ where: { id: input.fabricId }, select: { id: true } })
      : Promise.resolve(undefined),
  ]);

  if (input.productId && !product) {
    throw new NotFoundError("Product not found");
  }

  if (input.sizeId && !size) {
    throw new NotFoundError("Size not found");
  }

  if (input.colorId && !color) {
    throw new NotFoundError("Color not found");
  }

  if (input.fabricId && !fabric) {
    throw new NotFoundError("Fabric not found");
  }
};

const createVariant = async (input: CreateVariantInput) => {
  await assertRelations(input);

  const colorId = input.colorId ?? null;
  const duplicate = await prisma.productVariant.findFirst({
    where: {
      productId: input.productId,
      sizeId: input.sizeId,
      fabricId: input.fabricId,
      colorId,
    },
    select: { id: true },
  });

  if (duplicate) {
    throw AppError.conflict(
      colorId
        ? "This size, color, and fabric combination already exists for the product"
        : "This size and fabric combination already exists for the product",
    );
  }

  try {
    const variant = await prisma.productVariant.create({
      data: {
        productId: input.productId,
        sizeId: input.sizeId,
        colorId,
        fabricId: input.fabricId,
        sku: input.sku,
        barcode: input.barcode,
        price: input.price,
        compareAtPrice: input.compareAtPrice,
        stock: input.stock,
        lowStockThreshold: input.lowStockThreshold,
        weightGrams: input.weightGrams,
        isActive: input.isActive,
      },
      include: variantInclude,
    });

    await invalidateCache("products");
    return variant;
  } catch (error) {
    return rethrowWriteError(error);
  }
};

const getAllVariants = async (query: VariantListQuery) => {
  const where: Prisma.ProductVariantWhereInput = {
    ...(query.productId ? { productId: query.productId } : {}),
    ...(query.sizeId ? { sizeId: query.sizeId } : {}),
    ...(query.colorId ? { colorId: query.colorId } : {}),
    ...(query.fabricId ? { fabricId: query.fabricId } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.inStock ? { stock: { gt: 0 } } : {}),
  };

  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.productVariant.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { createdAt: "desc" },
      include: variantInclude,
    }),
    prisma.productVariant.count({ where }),
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

const getSingleVariant = async (id: string) => {
  const variant = await prisma.productVariant.findUnique({
    where: { id },
    include: variantInclude,
  });

  if (!variant) {
    throw new NotFoundError("Variant not found");
  }

  return variant;
};

const updateVariant = async (id: string, input: UpdateVariantInput) => {
  const existing = await prisma.productVariant.findUnique({
    where: { id },
    select: {
      id: true,
      productId: true,
      price: true,
      reserved: true,
    },
  });

  if (!existing) {
    throw new NotFoundError("Variant not found");
  }

  await assertRelations({
    sizeId: input.sizeId,
    colorId: input.colorId,
    fabricId: input.fabricId,
  });

  if (input.stock !== undefined && input.stock < existing.reserved) {
    throw AppError.badRequest(
      `Stock cannot be lower than the ${existing.reserved} reserved units`,
    );
  }

  const nextPrice =
    input.price === undefined
      ? existing.price === null
        ? null
        : Number(existing.price)
      : input.price;

  if (
    input.compareAtPrice != null &&
    nextPrice != null &&
    input.compareAtPrice <= nextPrice
  ) {
    throw AppError.badRequest("compareAtPrice must be greater than price");
  }

  try {
    const variant = await prisma.productVariant.update({
      where: { id },
      data: input,
      include: variantInclude,
    });

    await invalidateCache("products");
    return variant;
  } catch (error) {
    return rethrowWriteError(error);
  }
};

const deleteVariant = async (id: string) => {
  const existing = await prisma.productVariant.findUnique({
    where: { id },
    select: {
      id: true,
      _count: {
        select: {
          cartItems: true,
          orderItems: true,
          exchanges: true,
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError("Variant not found");
  }

  const { orderItems, exchanges } = existing._count;

  if (orderItems > 0 || exchanges > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({ where: { variantId: id } });
      await tx.productVariant.update({ where: { id }, data: { isActive: false } });
    });
    await invalidateCache("products");
    return { deactivated: true as const };
  }

  await prisma.$transaction(async (tx) => {
    await tx.cartItem.deleteMany({ where: { variantId: id } });
    await tx.productVariant.delete({ where: { id } });
  });
  await invalidateCache("products");
  return { deactivated: false as const };
};

export const variantService = {
  createVariant,
  getAllVariants,
  getSingleVariant,
  updateVariant,
  deleteVariant,
};
