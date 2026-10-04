import { randomBytes } from "node:crypto";
import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../app/config/prisma";
import { AppError } from "../../app/errors/AppError";
import { NotFoundError } from "../../app/errors/NotFoundError";
import type { AuthContext } from "../../app/middlewares/auth";
import type { CreateReturnInput, ReturnListQuery, ReviewReturnInput } from "./return.validation";

const openReturnStatuses = ["REQUESTED", "APPROVED", "IN_TRANSIT", "RECEIVED"] as const;

const returnInclude = {
  items: {
    include: {
      orderItem: {
        select: {
          id: true,
          productName: true,
          sku: true,
          size: true,
          color: true,
          fabric: true,
          quantity: true,
          unitPrice: true,
        },
      },
      exchangeVariant: {
        select: {
          id: true,
          sku: true,
          size: { select: { name: true } },
          color: { select: { name: true, hexCode: true } },
          fabric: { select: { name: true } },
        },
      },
    },
  },
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      currency: true,
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
} satisfies Prisma.ReturnRequestInclude;

const money = (value: number): number => Math.round(value * 100) / 100;

const createReturnNumber = (): string => {
  const time = Date.now().toString(36).toUpperCase();
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `RET-${time}-${suffix}`;
};

const createReturn = async (userId: string, input: CreateReturnInput) => {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: {
      items: true,
    },
  });

  if (!order || order.userId !== userId) {
    throw new NotFoundError("Order not found");
  }

  if (order.status !== "DELIVERED" && order.status !== "RETURN_REQUESTED") {
    throw AppError.badRequest("Returns can only be requested for a delivered order");
  }

  const orderItemById = new Map(order.items.map((item) => [item.id, item]));
  const requestedIds = input.items.map((item) => item.orderItemId);
  const previous = await prisma.returnItem.groupBy({
    by: ["orderItemId"],
    where: {
      orderItemId: { in: requestedIds },
      returnRequest: {
        orderId: order.id,
        status: { in: [...openReturnStatuses] },
      },
    },
    _sum: { quantity: true },
  });
  const alreadyRequested = new Map(
    previous.map((row) => [row.orderItemId, row._sum.quantity ?? 0]),
  );

  const exchangeIds = input.items
    .map((item) => item.exchangeVariantId)
    .filter((id): id is string => Boolean(id));
  const exchangeVariants =
    exchangeIds.length === 0
      ? []
      : await prisma.productVariant.findMany({
          where: { id: { in: exchangeIds } },
          select: { id: true, isActive: true, product: { select: { status: true } } },
        });
  const exchangeById = new Map(exchangeVariants.map((variant) => [variant.id, variant]));

  const lines = input.items.map((item) => {
    const orderItem = orderItemById.get(item.orderItemId);

    if (!orderItem) {
      throw AppError.badRequest("One or more items do not belong to this order");
    }

    const remaining = orderItem.quantity - (alreadyRequested.get(orderItem.id) ?? 0);

    if (item.quantity > remaining) {
      throw AppError.badRequest(
        remaining <= 0
          ? `${orderItem.productName} has already been submitted for return`
          : `Only ${remaining} of ${orderItem.productName} can be returned`,
      );
    }

    if (item.exchangeVariantId) {
      const replacement = exchangeById.get(item.exchangeVariantId);

      if (!replacement || !replacement.isActive || replacement.product.status !== "ACTIVE") {
        throw AppError.badRequest("The requested exchange variant is not available");
      }
    }

    return {
      orderItemId: orderItem.id,
      quantity: item.quantity,
      exchangeVariantId: item.exchangeVariantId,
      conditionNote: item.conditionNote,
      unitPrice: Number(orderItem.unitPrice),
    };
  });

  const refundAmount =
    input.type === "RETURN"
      ? money(lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0))
      : null;

  return prisma.$transaction(async (tx) => {
    const request = await tx.returnRequest.create({
      data: {
        returnNumber: createReturnNumber(),
        orderId: order.id,
        userId,
        type: input.type,
        reason: input.reason,
        note: input.note,
        refundAmount,
        items: {
          create: lines.map((line) => ({
            orderItemId: line.orderItemId,
            quantity: line.quantity,
            exchangeVariantId: line.exchangeVariantId,
            conditionNote: line.conditionNote,
          })),
        },
      },
      include: returnInclude,
    });

    if (order.status === "DELIVERED") {
      await tx.order.update({
        where: { id: order.id },
        data: { status: "RETURN_REQUESTED" },
      });
    }

    return request;
  });
};

const getReturns = async (auth: AuthContext, query: ReturnListQuery) => {
  const where: Prisma.ReturnRequestWhereInput = {
    ...(auth.role === "USER" ? { userId: auth.id } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await prisma.$transaction([
    prisma.returnRequest.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { requestedAt: "desc" },
      include: returnInclude,
    }),
    prisma.returnRequest.count({ where }),
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

const getReturn = async (auth: AuthContext, id: string) => {
  const request = await prisma.returnRequest.findUnique({
    where: { id },
    include: returnInclude,
  });

  if (!request || (auth.role === "USER" && request.userId !== auth.id)) {
    throw new NotFoundError("Return request not found");
  }

  return request;
};

const reviewReturn = async (adminId: string, id: string, input: ReviewReturnInput) => {
  return prisma.$transaction(async (tx) => {
    const request = await tx.returnRequest.findUnique({
      where: { id },
      select: { id: true, orderId: true, status: true },
    });

    if (!request) {
      throw new NotFoundError("Return request not found");
    }

    if (request.status !== "REQUESTED") {
      throw AppError.badRequest("Only a requested return can be approved or rejected");
    }

    const updated = await tx.returnRequest.update({
      where: { id },
      data: {
        status: input.decision,
        adminNote: input.adminNote,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
      include: returnInclude,
    });

    if (input.decision === "REJECTED") {
      const stillOpen = await tx.returnRequest.count({
        where: {
          orderId: request.orderId,
          status: { in: [...openReturnStatuses] },
        },
      });

      if (stillOpen === 0) {
        await tx.order.update({
          where: { id: request.orderId },
          data: { status: "DELIVERED" },
        });
      }
    }

    return updated;
  });
};

export const returnService = {
  createReturn,
  getReturns,
  getReturn,
  reviewReturn,
};
