import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../app/config/prisma";
import { AppError } from "../../app/errors/AppError";
import { NotFoundError } from "../../app/errors/NotFoundError";
import type {
  ApplyCouponInput,
  CouponListQuery,
  CreateCouponInput,
  UpdateCouponInput,
} from "./coupon.validation";

const couponSelect = {
  id: true,
  code: true,
  description: true,
  type: true,
  value: true,
  minOrderAmount: true,
  maxDiscount: true,
  usageLimit: true,
  usageLimitPerUser: true,
  usedCount: true,
  startsAt: true,
  endsAt: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CouponSelect;

const money = (value: number): number => Math.round(value * 100) / 100;

const asMoney = (value: Prisma.Decimal | number | null | undefined): number =>
  Number(value ?? 0);

const createCoupon = async (input: CreateCouponInput) => {
  const existing = await prisma.coupon.findUnique({
    where: { code: input.code },
    select: { id: true },
  });

  if (existing) {
    throw AppError.conflict("A coupon with this code already exists");
  }

  try {
    return await prisma.coupon.create({
      data: {
        code: input.code,
        description: input.description,
        type: input.type,
        value: input.value,
        minOrderAmount: input.minOrderAmount,
        maxDiscount: input.maxDiscount,
        usageLimit: input.usageLimit,
        usageLimitPerUser: input.usageLimitPerUser ?? 1,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        isActive: input.isActive ?? true,
      },
      select: couponSelect,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw AppError.conflict("A coupon with this code already exists");
    }

    throw error;
  }
};

const getCoupons = async (query: CouponListQuery) => {
  const where: Prisma.CouponWhereInput = {
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.search ? { code: { contains: query.search, mode: "insensitive" } } : {}),
  };
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await prisma.$transaction([
    prisma.coupon.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { createdAt: "desc" },
      select: couponSelect,
    }),
    prisma.coupon.count({ where }),
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

const getCoupon = async (id: string) => {
  const coupon = await prisma.coupon.findUnique({
    where: { id },
    select: couponSelect,
  });

  if (!coupon) {
    throw new NotFoundError("Coupon not found");
  }

  return coupon;
};

const updateCoupon = async (id: string, input: UpdateCouponInput) => {
  const existing = await prisma.coupon.findUnique({
    where: { id },
    select: { id: true, type: true, value: true, startsAt: true, endsAt: true },
  });

  if (!existing) {
    throw new NotFoundError("Coupon not found");
  }

  const nextType = input.type ?? existing.type;
  const nextValue = input.value ?? asMoney(existing.value);
  const nextStart = input.startsAt ?? existing.startsAt;
  const nextEnd = input.endsAt ?? existing.endsAt;

  if (nextEnd <= nextStart) {
    throw AppError.badRequest("endsAt must be after startsAt");
  }

  if (nextType === "PERCENTAGE" && nextValue > 100) {
    throw AppError.badRequest("Percentage discount cannot exceed 100");
  }

  return prisma.coupon.update({
    where: { id },
    data: input,
    select: couponSelect,
  });
};

const deleteCoupon = async (id: string) => {
  const existing = await prisma.coupon.findUnique({
    where: { id },
    select: { id: true, usedCount: true },
  });

  if (!existing) {
    throw new NotFoundError("Coupon not found");
  }

  if (existing.usedCount > 0) {
    throw AppError.conflict("This coupon has already been used. Deactivate it instead");
  }

  await prisma.coupon.delete({ where: { id } });
};

const cartSubtotal = async (userId: string): Promise<number> => {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          variant: {
            select: {
              price: true,
              product: { select: { basePrice: true } },
            },
          },
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    throw AppError.badRequest("Your cart is empty");
  }

  return money(
    cart.items.reduce((total, item) => {
      const unitPrice = asMoney(item.variant.price ?? item.variant.product.basePrice);
      return total + unitPrice * item.quantity;
    }, 0),
  );
};

const calculateDiscount = (
  coupon: {
    type: "PERCENTAGE" | "FIXED_AMOUNT";
    value: Prisma.Decimal;
    maxDiscount: Prisma.Decimal | null;
  },
  subtotal: number,
): number => {
  const raw =
    coupon.type === "PERCENTAGE" ? (subtotal * asMoney(coupon.value)) / 100 : asMoney(coupon.value);
  const capped = coupon.maxDiscount === null ? raw : Math.min(raw, asMoney(coupon.maxDiscount));

  return money(Math.min(Math.max(capped, 0), subtotal));
};

const applyCoupon = async (userId: string, input: ApplyCouponInput) => {
  const coupon = await prisma.coupon.findUnique({
    where: { code: input.code },
  });

  if (!coupon || !coupon.isActive) {
    throw AppError.badRequest("This coupon is not active");
  }

  const now = new Date();

  if (now < coupon.startsAt || now > coupon.endsAt) {
    throw AppError.badRequest("This coupon is not valid right now");
  }

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw AppError.badRequest("This coupon has reached its usage limit");
  }

  const userUses = await prisma.couponRedemption.count({
    where: { couponId: coupon.id, userId },
  });

  if (userUses >= coupon.usageLimitPerUser) {
    throw AppError.badRequest("You have already used this coupon");
  }

  let subtotal: number;
  let currency = "USD";

  if (input.orderId) {
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      select: { id: true, userId: true, status: true, subtotal: true, currency: true },
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundError("Order not found");
    }

    if (order.status !== "PENDING") {
      throw AppError.badRequest("A coupon can only be applied to a pending order");
    }

    subtotal = asMoney(order.subtotal);
    currency = order.currency;
  } else {
    subtotal = await cartSubtotal(userId);
  }

  if (coupon.minOrderAmount !== null && subtotal < asMoney(coupon.minOrderAmount)) {
    throw AppError.badRequest(
      `This coupon requires an order of at least ${asMoney(coupon.minOrderAmount)}`,
    );
  }

  const discount = calculateDiscount(coupon, subtotal);

  return {
    code: coupon.code,
    type: coupon.type,
    subtotal: money(subtotal),
    discount,
    total: money(subtotal - discount),
    currency,
  };
};

export const couponService = {
  createCoupon,
  getCoupons,
  getCoupon,
  updateCoupon,
  deleteCoupon,
  applyCoupon,
};
