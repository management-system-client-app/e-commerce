import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../app/config/prisma";
import { NotFoundError } from "../../app/errors/NotFoundError";

const productSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  gender: true,
  basePrice: true,
  compareAtPrice: true,
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
    orderBy: { sortOrder: "asc" as const },
    take: 1,
    select: {
      url: true,
      alt: true,
    },
  },
} satisfies Prisma.ProductSelect;

const getWishlist = async (userId: string) => {
  const items = await prisma.wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      product: { select: productSelect },
    },
  });

  return items;
};

const saveProduct = async (userId: string, productId: string) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  const item = await prisma.wishlistItem.upsert({
    where: {
      userId_productId: { userId, productId },
    },
    update: {},
    create: { userId, productId },
    select: {
      id: true,
      createdAt: true,
      product: { select: productSelect },
    },
  });

  return item;
};

const removeProduct = async (userId: string, productId: string) => {
  const removed = await prisma.wishlistItem.deleteMany({
    where: { userId, productId },
  });

  if (removed.count === 0) {
    throw new NotFoundError("Wishlist item not found");
  }
};

export const wishlistService = {
  getWishlist,
  saveProduct,
  removeProduct,
};
