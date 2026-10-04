import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../app/config/prisma";
import { AppError } from "../../app/errors/AppError";
import { NotFoundError } from "../../app/errors/NotFoundError";
import type { AddCartItemInput } from "./cart.validation";

const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      variant: {
        include: {
          size: { select: { id: true, name: true } },
          color: { select: { id: true, name: true, hexCode: true } },
          fabric: { select: { id: true, name: true } },
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              basePrice: true,
              images: {
                select: { url: true, isPrimary: true, colorId: true, sortOrder: true },
                orderBy: { sortOrder: "asc" as const },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

type CartRecord = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

const money = (value: number): number => Math.round(value * 100) / 100;

const asMoney = (value: Prisma.Decimal | number | null): number => Number(value ?? 0);

const unitPriceOf = (variant: CartRecord["items"][number]["variant"]): number =>
  money(asMoney(variant.price ?? variant.product.basePrice));

const availableQuantityOf = (variant: { stock: number; reserved: number }): number =>
  Math.max(variant.stock - variant.reserved, 0);

const imageForVariant = (
  variant: CartRecord["items"][number]["variant"],
): string | null => {
  const images = variant.product.images;
  const match =
    images.find((image) => image.colorId === variant.colorId && image.isPrimary) ??
    images.find((image) => image.colorId === variant.colorId) ??
    images.find((image) => image.isPrimary) ??
    images[0];

  return match?.url ?? null;
};

const toCartView = (cart: CartRecord | null) => {
  const items = (cart?.items ?? []).map((item) => {
    const unitPrice = unitPriceOf(item.variant);
    return {
      id: item.id,
      quantity: item.quantity,
      unitPrice,
      lineTotal: money(unitPrice * item.quantity),
      imageUrl: imageForVariant(item.variant),
      availableQuantity: availableQuantityOf(item.variant),
      variant: {
        id: item.variant.id,
        sku: item.variant.sku,
        isActive: item.variant.isActive,
        size: item.variant.size,
        color: item.variant.color,
        fabric: item.variant.fabric,
        product: {
          id: item.variant.product.id,
          name: item.variant.product.name,
          slug: item.variant.product.slug,
          status: item.variant.product.status,
        },
      },
    };
  });

  return {
    id: cart?.id ?? null,
    items,
    summary: {
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      subtotal: money(items.reduce((total, item) => total + item.lineTotal, 0)),
    },
  };
};

const getCartRecord = (userId: string) =>
  prisma.cart.findUnique({
    where: { userId },
    include: cartInclude,
  });

const assertPurchasable = (
  variant: {
    isActive: boolean;
    stock: number;
    reserved: number;
    product: { status: string; name: string };
  },
  quantity: number,
): void => {
  if (!variant.isActive || variant.product.status !== "ACTIVE") {
    throw AppError.badRequest(`${variant.product.name} is not available`);
  }

  const available = availableQuantityOf(variant);

  if (quantity > available) {
    throw AppError.badRequest(
      available === 0
        ? `${variant.product.name} is out of stock`
        : `Only ${available} of ${variant.product.name} are available`,
    );
  }
};

const getCart = async (userId: string) => {
  const cart = await getCartRecord(userId);
  return toCartView(cart);
};

const addItem = async (userId: string, input: AddCartItemInput) => {
  const variant = await prisma.productVariant.findUnique({
    where: { id: input.variantId },
    include: {
      product: { select: { status: true, name: true } },
    },
  });

  if (!variant) {
    throw new NotFoundError("Variant not found");
  }

  await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
      select: { id: true },
    });

    const existing = await tx.cartItem.findUnique({
      where: {
        cartId_variantId: {
          cartId: cart.id,
          variantId: input.variantId,
        },
      },
      select: { id: true, quantity: true },
    });

    const nextQuantity = (existing?.quantity ?? 0) + input.quantity;
    assertPurchasable(variant, nextQuantity);

    if (existing) {
      await tx.cartItem.update({
        where: { id: existing.id },
        data: { quantity: nextQuantity },
      });
      return;
    }

    await tx.cartItem.create({
      data: {
        cartId: cart.id,
        variantId: input.variantId,
        quantity: input.quantity,
      },
    });
  });

  return getCart(userId);
};

const removeItem = async (userId: string, itemId: string) => {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!cart) {
    throw new NotFoundError("Cart item not found");
  }

  const removed = await prisma.cartItem.deleteMany({
    where: { id: itemId, cartId: cart.id },
  });

  if (removed.count === 0) {
    throw new NotFoundError("Cart item not found");
  }

  return getCart(userId);
};

export const cartService = {
  getCart,
  addItem,
  removeItem,
};
