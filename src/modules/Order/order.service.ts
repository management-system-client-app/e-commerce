import { randomBytes } from "node:crypto";
import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../app/config/prisma";
import { AppError } from "../../app/errors/AppError";
import { NotFoundError } from "../../app/errors/NotFoundError";
import { resolveShipping } from "../Delivery/delivery.service";
import { chooseDiscount } from "../Promotion/promotion.service";
import { settingsService } from "../Settings/settings.service";
import { sendOrderConfirmationEmail, sendOrderShippedEmail } from "../../utils/emailSender";
import { sendOrderMail } from "../../utils/orderMail";
import type { AuthContext } from "../../app/middlewares/auth";
import type {
  OrderListQuery,
  OrderStatusValue,
  PlaceOrderInput,
  TrackOrderQuery,
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
  payments: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      provider: true,
      status: true,
      method: true,
      transactionId: true,
      failureReason: true,
      amount: true,
      currency: true,
      paidAt: true,
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

type OrderBuyer = { kind: "user"; userId: string } | { kind: "guest"; sessionId: string };

const placeOrder = async (buyer: OrderBuyer, input: PlaceOrderInput) => {
  if (buyer.kind === "guest" && !input.email) {
    throw AppError.badRequest("Email is required to place a guest order");
  }

  if (buyer.kind === "guest" && input.couponCode) {
    throw AppError.badRequest("Sign in to use a coupon");
  }

  const placed = await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({
      where: buyer.kind === "user" ? { userId: buyer.userId } : { sessionId: buyer.sessionId },
      include: { items: true },
    });

    if (!cart || cart.items.length === 0) {
      throw AppError.badRequest("Your cart is empty");
    }

    if (!cart.paymentMethod) {
      throw AppError.badRequest("Choose a payment method before placing the order");
    }

    const paymentMethod = cart.paymentMethod;
    const manualProvider = paymentMethod === "BKASH" || paymentMethod === "NAGAD" || paymentMethod === "ROCKET" ? paymentMethod : null;

    if (manualProvider) {
      const settings = await settingsService.getSettings();
      const walletNumber = manualProvider === "BKASH" ? settings.bkashNumber : manualProvider === "NAGAD" ? settings.nagadNumber : settings.rocketNumber;

      if (!walletNumber) {
        const walletLabel = manualProvider === "BKASH" ? "bKash Personal" : manualProvider === "NAGAD" ? "Nagad" : "Rocket";
        throw AppError.badRequest(`${walletLabel} number is not configured`);
      }
    }

    const variants = await tx.productVariant.findMany({
      where: { id: { in: cart.items.map((item) => item.variantId) } },
      include: {
        size: { select: { name: true } },
        color: { select: { name: true } },
        fabric: { select: { name: true } },
        product: {
          select: {
            id: true,
            name: true,
            status: true,
            categoryId: true,
            brandId: true,
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
        productId: variant.product.id,
        categoryId: variant.product.categoryId,
        brandId: variant.product.brandId,
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
    const discount = await chooseDiscount(
      tx,
      buyer.kind === "user" ? buyer.userId : "",
      lines.map((line) => ({
        productId: line.productId,
        categoryId: line.categoryId,
        brandId: line.brandId,
        lineTotal: line.lineTotal,
      })),
      input.couponCode,
    );
    const discountAmount = discount.discount;
    const zones = await tx.deliveryZone.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        city: true,
        fee: true,
        freeShippingOver: true,
      },
    });
    const shipping = resolveShipping(zones, input.shippingCity, subtotal);
    const shippingAmount = money(shipping.fee);
    const total = money(subtotal - discountAmount + shippingAmount);

    const order = await tx.order.create({
      data: {
        orderNumber: createOrderNumber(),
        userId: buyer.kind === "user" ? buyer.userId : null,
        guestEmail: buyer.kind === "guest" ? input.email : null,
        status: paymentMethod === "COD" ? "CONFIRMED" : "PENDING",
        subtotal,
        discountAmount,
        shippingAmount,
        taxAmount: 0,
        total,
        ...(discount.couponId ? { couponId: discount.couponId } : {}),
        ...(discount.promotionId ? { promotionId: discount.promotionId } : {}),
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
        ...(paymentMethod === "COD"
          ? {
              payments: {
                create: {
                  provider: "COD" as const,
                  status: "PENDING" as const,
                  amount: total,
                  currency: "USD",
                  method: "cash_on_delivery",
                },
              },
            }
          : manualProvider
            ? {
                payments: {
                  create: {
                    provider: manualProvider,
                    status: "PENDING" as const,
                    amount: total,
                    currency: "USD",
                    method: manualProvider.toLowerCase(),
                  },
                },
              }
            : {}),
      },
      include: orderDetailInclude,
    });

    if (discount.couponId && buyer.kind === "user") {
      const uses = await tx.couponRedemption.count({
        where: { couponId: discount.couponId, userId: buyer.userId },
      });

      if (discount.usageLimitPerUser != null && uses >= discount.usageLimitPerUser) {
        throw AppError.badRequest("You have already used this coupon");
      }

      const redeemed = await tx.coupon.updateMany({
        where: {
          id: discount.couponId,
          isActive: true,
          ...(discount.usageLimit != null ? { usedCount: { lt: discount.usageLimit } } : {}),
        },
        data: { usedCount: { increment: 1 } },
      });

      if (redeemed.count !== 1) {
        throw AppError.badRequest("This coupon has reached its usage limit");
      }

      await tx.couponRedemption.create({
        data: {
          couponId: discount.couponId,
          userId: buyer.userId,
          orderId: order.id,
          discount: discountAmount,
        },
      });
    }

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    await tx.cart.update({
      where: { id: cart.id },
      data: { paymentMethod: null },
    });

    return { order, paymentMethod };
  }, {
    timeout: 15_000,
  });

  const customerName = placed.order.user
    ? `${placed.order.user.firstName} ${placed.order.user.lastName}`.trim()
    : placed.order.shippingFullName;
  const customerEmail = placed.order.user?.email ?? placed.order.guestEmail;
  const total = Number(placed.order.total);

  let payTo: string | null = null;
  if (placed.paymentMethod === "BKASH" || placed.paymentMethod === "NAGAD" || placed.paymentMethod === "ROCKET") {
    const settings = await settingsService.getSettings();
    payTo = placed.paymentMethod === "BKASH" ? settings.bkashNumber : placed.paymentMethod === "NAGAD" ? settings.nagadNumber : settings.rocketNumber;
  }

  const manualWallet = placed.paymentMethod === "BKASH" ? "bKash Personal" : placed.paymentMethod === "NAGAD" ? "Nagad" : placed.paymentMethod === "ROCKET" ? "Rocket" : null;
  const paymentNote = payTo
    ? `Send the total to ${manualWallet} ${payTo}, then submit the transaction id for approval.`
    : placed.paymentMethod === "COD"
      ? "Pay cash when the order arrives."
      : "Open the store receipt and pay by card to confirm the order.";

  const manualPaymentPending = placed.paymentMethod === "BKASH" || placed.paymentMethod === "NAGAD" || placed.paymentMethod === "ROCKET";
  const emailed = customerEmail && !manualPaymentPending
    ? await sendOrderMail(() =>
        sendOrderConfirmationEmail({
          to: customerEmail,
          customerName,
          orderNumber: placed.order.orderNumber,
          total,
          currency: placed.order.currency,
          paymentNote,
          items: placed.order.items.map((item) => ({
            name: item.productName,
            quantity: item.quantity,
            lineTotal: Number(item.lineTotal),
          })),
        }),
      )
    : false;

  return { ...placed, payTo, emailed };
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

const phoneKey = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

const trackOrder = async (query: TrackOrderQuery) => {
  const order = await prisma.order.findFirst({
    where: {
      orderNumber: { equals: query.orderNumber, mode: "insensitive" },
    },
    select: {
      orderNumber: true,
      status: true,
      currency: true,
      total: true,
      placedAt: true,
      paidAt: true,
      shippedAt: true,
      deliveredAt: true,
      cancelledAt: true,
      shippingPhone: true,
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          productName: true,
          sku: true,
          size: true,
          color: true,
          fabric: true,
          imageUrl: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
        },
      },
    },
  });

  if (!order || phoneKey(order.shippingPhone) !== phoneKey(query.phone)) {
    throw new NotFoundError("Order not found");
  }

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    currency: order.currency,
    total: order.total,
    placedAt: order.placedAt,
    paidAt: order.paidAt,
    shippedAt: order.shippedAt,
    deliveredAt: order.deliveredAt,
    cancelledAt: order.cancelledAt,
    items: order.items,
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
  const updated = await prisma.$transaction(async (tx) => {
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

  const shippedEmail = updated.user?.email ?? updated.guestEmail;

  if (updated.status === "SHIPPED" && shippedEmail) {
    await sendOrderMail(() =>
      sendOrderShippedEmail({
        to: shippedEmail,
        customerName: updated.user
          ? `${updated.user.firstName} ${updated.user.lastName}`.trim()
          : updated.shippingFullName,
        orderNumber: updated.orderNumber,
      }),
    );
  }

  return updated;
};

const cancelUnpaidOrder = async (orderId: string, reason: string): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: { select: { variantId: true, quantity: true } },
        payments: { select: { status: true } },
      },
    });

    if (!order || order.status !== "PENDING") {
      return;
    }

    if (order.payments.some((payment) => payment.status === "PAID")) {
      return;
    }

    for (const item of order.items) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
    }

    await tx.payment.updateMany({
      where: {
        orderId,
        status: { in: ["PENDING", "PROCESSING", "AUTHORIZED", "FAILED"] },
      },
      data: { status: "CANCELLED" },
    });

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    });
  });
};

export const orderService = {
  placeOrder,
  cancelUnpaidOrder,
  getOrders,
  getOrder,
  trackOrder,
  updateOrderStatus,
};
