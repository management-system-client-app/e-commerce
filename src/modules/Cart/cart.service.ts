import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../app/config/prisma";
import { AppError } from "../../app/errors/AppError";
import { NotFoundError } from "../../app/errors/NotFoundError";
import type { AddCartItemInput, CartPaymentInput } from "./cart.validation";

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
    sessionId: cart?.sessionId ?? null,
    paymentMethod: cart?.paymentMethod ?? null,
    items,
    summary: {
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      subtotal: money(items.reduce((total, item) => total + item.lineTotal, 0)),
    },
  };
};

export type CartOwner =
  | { kind: "user"; userId: string }
  | { kind: "guest"; sessionId: string };

const cartWhere = (owner: CartOwner) =>
  owner.kind === "user" ? { userId: owner.userId } : { sessionId: owner.sessionId };

const getCartRecord = (owner: CartOwner) =>
  prisma.cart.findUnique({
    where: cartWhere(owner),
    include: cartInclude,
  });

const emptyCart = () => toCartView(null);

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

const getCart = async (owner: CartOwner) => {
  const cart = await getCartRecord(owner);
  return toCartView(cart);
};

const variantChoice = (variant: {
  id: string;
  sku: string;
  size: { name: string };
  fabric: { name: string };
}) => ({
  path: "variantId",
  message: `${variant.size.name} / ${variant.fabric.name} (${variant.sku}): ${variant.id}`,
});

const resolveVariantId = async (input: AddCartItemInput): Promise<string> => {
  if (input.variantId) {
    return input.variantId;
  }

  if (!input.productId) {
    throw AppError.badRequest("Send productId or variantId");
  }

  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: {
      name: true,
      variants: {
        where: { isActive: true },
        select: {
          id: true,
          sku: true,
          size: { select: { name: true } },
          fabric: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  if (product.variants.length === 0) {
    throw AppError.badRequest(`${product.name} has no size yet. Create a variant first.`);
  }

  if (product.variants.length === 1) {
    return product.variants[0].id;
  }

  throw AppError.badRequest(
    `${product.name} has more than one size. Send one variantId.`,
    product.variants.map(variantChoice),
  );
};

const addItem = async (owner: CartOwner, input: AddCartItemInput) => {
  const variantId = await resolveVariantId(input);
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: {
      product: { select: { status: true, name: true } },
    },
  });

  if (!variant) {
    const product = await prisma.product.findUnique({
      where: { id: variantId },
      select: { id: true },
    });

    if (product) {
      throw AppError.badRequest(
        "That id is a product. Send it as productId, or copy variants[].id from the product.",
      );
    }

    throw new NotFoundError("Variant not found");
  }

  await prisma.$transaction(async (tx) => {
    const cart =
      owner.kind === "user"
        ? await tx.cart.upsert({
            where: { userId: owner.userId },
            update: {},
            create: { userId: owner.userId },
            select: { id: true },
          })
        : await tx.cart.upsert({
            where: { sessionId: owner.sessionId },
            update: {},
            create: { sessionId: owner.sessionId },
            select: { id: true },
          });

    const existing = await tx.cartItem.findUnique({
      where: {
        cartId_variantId: {
          cartId: cart.id,
          variantId,
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
        variantId,
        quantity: input.quantity,
      },
    });
  });

  return getCart(owner);
};

const removeItem = async (owner: CartOwner, itemId: string) => {
  const cart = await prisma.cart.findUnique({
    where: cartWhere(owner),
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

  const remaining = await prisma.cartItem.count({ where: { cartId: cart.id } });

  if (remaining === 0) {
    await prisma.cart.update({
      where: { id: cart.id },
      data: { paymentMethod: null },
    });
  }

  return getCart(owner);
};

const choosePayment = async (owner: CartOwner, input: CartPaymentInput) => {
  const cart = await prisma.cart.findUnique({
    where: cartWhere(owner),
    select: { id: true, _count: { select: { items: true } } },
  });

  if (!cart || cart._count.items === 0) {
    throw AppError.badRequest("Add an item to the cart before choosing a payment method");
  }

  await prisma.cart.update({
    where: { id: cart.id },
    data: { paymentMethod: input.paymentMethod },
  });

  return getCart(owner);
};

const mergeGuestCart = async (userId: string, sessionId: string): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const guest = await tx.cart.findUnique({
      where: { sessionId },
      include: {
        items: { select: { variantId: true, quantity: true } },
      },
    });

    if (!guest || guest.userId) {
      return;
    }

    if (guest.items.length === 0) {
      await tx.cart.delete({ where: { id: guest.id } });
      return;
    }

    const userCart = await tx.cart.upsert({
      where: { userId },
      update: guest.paymentMethod ? { paymentMethod: guest.paymentMethod } : {},
      create: { userId, paymentMethod: guest.paymentMethod },
      select: { id: true },
    });

    const variants = await tx.productVariant.findMany({
      where: { id: { in: guest.items.map((item) => item.variantId) } },
      select: {
        id: true,
        isActive: true,
        stock: true,
        reserved: true,
        product: { select: { status: true } },
      },
    });
    const variantById = new Map(variants.map((variant) => [variant.id, variant]));

    for (const item of guest.items) {
      const variant = variantById.get(item.variantId);

      if (!variant || !variant.isActive || variant.product.status !== "ACTIVE") {
        continue;
      }

      const existing = await tx.cartItem.findUnique({
        where: {
          cartId_variantId: {
            cartId: userCart.id,
            variantId: item.variantId,
          },
        },
        select: { id: true, quantity: true },
      });

      const nextQuantity = Math.min(
        (existing?.quantity ?? 0) + item.quantity,
        availableQuantityOf(variant),
      );

      if (nextQuantity <= 0) {
        continue;
      }

      if (existing) {
        await tx.cartItem.update({
          where: { id: existing.id },
          data: { quantity: nextQuantity },
        });
        continue;
      }

      await tx.cartItem.create({
        data: {
          cartId: userCart.id,
          variantId: item.variantId,
          quantity: nextQuantity,
        },
      });
    }

    await tx.cart.delete({ where: { id: guest.id } });
  });
};

export const cartService = {
  emptyCart,
  getCart,
  addItem,
  choosePayment,
  removeItem,
  mergeGuestCart,
};
