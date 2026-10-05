import { randomBytes } from "node:crypto";
import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../app/config/prisma";
import { AppError } from "../../app/errors/AppError";
import { NotFoundError } from "../../app/errors/NotFoundError";
import type { AuthContext } from "../../app/middlewares/auth";
import type {
  OrderListQuery,
  OrderStatusValue,
  PlaceOrderInput,
  UpdateOrderStatusInput,
} from "./order.validation";

const orderListInclude = {
  items: {
    select: {
      id: true,
      productName: true,
      sku: true,
      quantity: true,
      lineTotal: true,
    },
  },
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
} satisfies Prisma.OrderInclude;

const orderDetailInclude = {
  items: {
    orderBy: { createdAt: "asc" as const },
  },
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
} satisfies Prisma.OrderInclude;

const transitions: Record<OrderStatusValue, OrderStatusValue[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["RETURN_REQUESTED"],
  RETURN_REQUESTED: ["PARTIALLY_RETURNED", "RETURNED"],
  PARTIALLY_RETURNED: ["RETURNED"],
  RETURNED: [],
  CANCELLED: [],
};

const restockOnCancel = new Set<OrderStatusValue>(["PENDING", "CONFIRMED", "PROCESSING"]);

const money = (value: number): number => Math.round(value * 100) / 100;

const asMoney = (value: Prisma.Decimal | number | null): number => Number(value ?? 0);

const createOrderNumber = (): string => {
  const time = Date.now().toString(36).toUpperCase();
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `ORD-${time}-${suffix}`;
};

const placeOrder = async (userId: string, input: PlaceOrderInput) => {
  return prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({
      where: { userId },
      include: { items: true },
    });

    if (!cart || cart.items.length === 0) {
      throw AppError.badRequest("Your cart is empty");
    }

    const variants = await tx.productVariant.findMany({
      where: { id: { in: cart.items.map((item) => item.variantId) } },
      include: {
        size: { select: { name: true } },
        color: { select: { name: true } },
        fabric: { select: { name: true } },
        product: {
          select: {
            name: true,
            status: true,
            basePrice: true,
            images: {
              select: { url: true, isPrimary: true, colorId: true, sortOrder: true },
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });

    const variantById = new Map(variants.map((variant) => [variant.id, variant]));
    const lines = cart.items.map((item) => {
      const variant = variantById.get(item.variantId);

      if (!variant) {
        throw new NotFoundError("A cart item is no longer available");
      }

      if (!variant.isActive || variant.product.status !== "ACTIVE") {
        throw AppError.badRequest(`${variant.product.name} is not available`);
      }

      const available = variant.stock - variant.reserved;

      if (item.quantity > available) {
        throw AppError.badRequest(
          available <= 0
            ? `${variant.product.name} is out of stock`
            : `Only ${available} of ${variant.product.name} are available`,
        );
      }

      const unitPrice = money(asMoney(variant.price ?? variant.product.basePrice));
      const image =
        variant.product.images.find(
          (entry) => entry.colorId === variant.colorId && entry.isPrimary,
        ) ??
        variant.product.images.find((entry) => entry.colorId === variant.colorId) ??
        variant.product.images.find((entry) => entry.isPrimary) ??
        variant.product.images[0];

      return {
        variantId: variant.id,
        productName: variant.product.name,
        sku: variant.sku,
        size: variant.size.name,
        color: variant.color?.name ?? "",
        fabric: variant.fabric.name,
        imageUrl: image?.url,
        quantity: item.quantity,
        unitPrice,
        lineTotal: money(unitPrice * item.quantity),
        reserved: variant.reserved,
      };
    });

    for (const line of lines) {
      const updated = await tx.productVariant.updateMany({
        where: {
          id: line.variantId,
          isActive: true,
          stock: { gte: line.reserved + line.quantity },
        },
        data: { stock: { decrement: line.quantity } },
      });

      if (updated.count !== 1) {
        throw AppError.badRequest("Stock changed while placing the order. Please try again");
      }
    }

    const subtotal = money(lines.reduce((total, line) => total + line.lineTotal, 0));

    const order = await tx.order.create({
      data: {
        orderNumber: createOrderNumber(),
        userId,
        status: "PENDING",
        subtotal,
        discountAmount: 0,
        shippingAmount: 0,
        taxAmount: 0,
        total: subtotal,
        currency: "USD",
        shippingFullName: input.shippingFullName,
        shippingPhone: input.shippingPhone,
        shippingLine1: input.shippingLine1,
        shippingLine2: input.shippingLine2,
        shippingCity: input.shippingCity,
        shippingState: input.shippingState,
        shippingPostalCode: input.shippingPostalCode,
        shippingCountry: input.shippingCountry,
        customerNote: input.customerNote,
        items: {
          create: lines.map((line) => ({
            variantId: line.variantId,
            productName: line.productName,
            sku: line.sku,
            size: line.size,
            color: line.color,
            fabric: line.fabric,
            imageUrl: line.imageUrl,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
          })),
        },
      },
      include: orderDetailInclude,
    });

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return order;
  });
};

const getOrders = async (auth: AuthContext, query: OrderListQuery) => {
  const where: Prisma.OrderWhereInput = {
    ...(auth.role === "USER" ? { userId: auth.id } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { placedAt: "desc" },
      include: orderListInclude,
    }),
    prisma.order.count({ where }),
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

const getOrder = async (auth: AuthContext, id: string) => {
  const order = await prisma.order.findUnique({
    where: { id },
    include: orderDetailInclude,
  });

  if (!order || (auth.role === "USER" && order.userId !== auth.id)) {
    throw new NotFoundError("Order not found");
  }

  return order;
};

const updateOrderStatus = async (id: string, input: UpdateOrderStatusInput) => {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      include: {
        items: { select: { variantId: true, quantity: true } },
      },
    });

    if (!order) {
      throw new NotFoundError("Order not found");
    }

    const currentStatus = order.status as OrderStatusValue;
    const nextStatus = input.status;

    if (!transitions[currentStatus].includes(nextStatus)) {
      throw AppError.badRequest(`Cannot change an order from ${currentStatus} to ${nextStatus}`);
    }

    if (nextStatus === "CANCELLED" && restockOnCancel.has(currentStatus)) {
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    const now = new Date();

    return tx.order.update({
      where: { id },
      data: {
        status: nextStatus,
        ...(nextStatus === "SHIPPED" ? { shippedAt: now } : {}),
        ...(nextStatus === "DELIVERED" ? { deliveredAt: now } : {}),
        ...(nextStatus === "CANCELLED"
          ? { cancelledAt: now, cancelReason: input.cancelReason }
          : {}),
      },
      include: orderDetailInclude,
    });
  });
};

export const orderService = {
  placeOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
};
