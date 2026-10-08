import { Prisma } from "../../../generated/prisma/client";
import {
  cacheGetOrSet,
  CATALOG_CACHE_TTL_SECONDS,
  invalidateCache,
} from "../../app/config/cache";
import { prisma } from "../../app/config/prisma";
import { AppError } from "../../app/errors/AppError";
import { NotFoundError } from "../../app/errors/NotFoundError";
import type {
  CreatePromotionInput,
  PromotionListQuery,
  UpdatePromotionInput,
} from "./promotion.validation";

const promotionInclude = {
  products: { select: { productId: true } },
  categories: { select: { categoryId: true } },
  brands: { select: { brandId: true } },
} satisfies Prisma.PromotionInclude;

type PromotionRecord = Prisma.PromotionGetPayload<{ include: typeof promotionInclude }>;

export type DiscountLine = {
  productId: string;
  categoryId: string;
  brandId: string;
  lineTotal: number;
};

export type DiscountDecision = {
  discount: number;
  couponId: string | null;
  promotionId: string | null;
  usageLimit: number | null;
  usageLimitPerUser: number | null;
  source: "COUPON" | "PROMOTION" | null;
  label: string | null;
};

type DiscountClient = {
  promotion: {
    findMany: typeof prisma.promotion.findMany;
  };
  coupon: {
    findUnique: typeof prisma.coupon.findUnique;
  };
  couponRedemption: {
    count: typeof prisma.couponRedemption.count;
  };
};

const money = (value: number): number => Math.round(value * 100) / 100;

const asMoney = (value: Prisma.Decimal | number | null | undefined): number => Number(value ?? 0);

const slugify = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);

const present = (promotion: PromotionRecord) => {
  const { products, categories, brands, ...rest } = promotion;

  return {
    ...rest,
    productIds: products.map((entry) => entry.productId),
    categoryIds: categories.map((entry) => entry.categoryId),
    brandIds: brands.map((entry) => entry.brandId),
  };
};

const assertIds = async (model: "product" | "category" | "brand", ids: string[] | undefined) => {
  if (!ids || ids.length === 0) {
    return;
  }

  const unique = [...new Set(ids)];
  const found =
    model === "product"
      ? await prisma.product.findMany({ where: { id: { in: unique } }, select: { id: true } })
      : model === "category"
        ? await prisma.category.findMany({ where: { id: { in: unique } }, select: { id: true } })
        : await prisma.brand.findMany({ where: { id: { in: unique } }, select: { id: true } });

  if (found.length !== unique.length) {
    throw AppError.badRequest(`One or more ${model}s were not found`);
  }
};

const discountAmount = (
  type: "PERCENTAGE" | "FIXED_AMOUNT",
  value: number,
  maxDiscount: number | null,
  base: number,
): number => {
  if (base <= 0) {
    return 0;
  }

  const raw = type === "PERCENTAGE" ? (base * value) / 100 : value;
  const capped = maxDiscount == null ? raw : Math.min(raw, maxDiscount);

  return money(Math.min(Math.max(capped, 0), base));
};

const eligibleBase = (
  promotion: {
    scope: "ORDER" | "PRODUCT" | "CATEGORY" | "BRAND";
    products: Array<{ productId: string }>;
    categories: Array<{ categoryId: string }>;
    brands: Array<{ brandId: string }>;
  },
  lines: DiscountLine[],
): number => {
  if (promotion.scope === "ORDER") {
    return money(lines.reduce((total, line) => total + line.lineTotal, 0));
  }

  const productIds = new Set(promotion.products.map((entry) => entry.productId));
  const categoryIds = new Set(promotion.categories.map((entry) => entry.categoryId));
  const brandIds = new Set(promotion.brands.map((entry) => entry.brandId));

  return money(
    lines.reduce((total, line) => {
      const matches =
        (promotion.scope === "PRODUCT" && productIds.has(line.productId)) ||
        (promotion.scope === "CATEGORY" && categoryIds.has(line.categoryId)) ||
        (promotion.scope === "BRAND" && brandIds.has(line.brandId));

      return matches ? total + line.lineTotal : total;
    }, 0),
  );
};

export const chooseDiscount = async (
  db: DiscountClient,
  userId: string,
  lines: DiscountLine[],
  couponCode?: string,
): Promise<DiscountDecision> => {
  const subtotal = money(lines.reduce((total, line) => total + line.lineTotal, 0));
  const now = new Date();
  const promotions = await db.promotion.findMany({
    where: {
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    include: promotionInclude,
  });

  let bestPromotion: DiscountDecision = {
    discount: 0,
    couponId: null,
    promotionId: null,
    usageLimit: null,
    usageLimitPerUser: null,
    source: null,
    label: null,
  };

  for (const promotion of promotions) {
    if (promotion.minOrderAmount != null && subtotal < asMoney(promotion.minOrderAmount)) {
      continue;
    }

    const base = eligibleBase(promotion, lines);
    const amount = discountAmount(
      promotion.type,
      asMoney(promotion.value),
      promotion.maxDiscount == null ? null : asMoney(promotion.maxDiscount),
      base,
    );

    if (amount > bestPromotion.discount) {
      bestPromotion = {
        discount: amount,
        couponId: null,
        promotionId: promotion.id,
        usageLimit: null,
        usageLimitPerUser: null,
        source: "PROMOTION",
        label: promotion.name,
      };
    }
  }

  if (!couponCode) {
    return bestPromotion;
  }

  const coupon = await db.coupon.findUnique({ where: { code: couponCode } });

  if (!coupon || !coupon.isActive) {
    throw AppError.badRequest("This coupon is not active");
  }

  if (now < coupon.startsAt || now > coupon.endsAt) {
    throw AppError.badRequest("This coupon is not valid right now");
  }

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw AppError.badRequest("This coupon has reached its usage limit");
  }

  const userUses = await db.couponRedemption.count({
    where: { couponId: coupon.id, userId },
  });

  if (userUses >= coupon.usageLimitPerUser) {
    throw AppError.badRequest("You have already used this coupon");
  }

  if (coupon.minOrderAmount !== null && subtotal < asMoney(coupon.minOrderAmount)) {
    throw AppError.badRequest(
      `This coupon requires an order of at least ${asMoney(coupon.minOrderAmount)}`,
    );
  }

  const couponDiscount = discountAmount(
    coupon.type,
    asMoney(coupon.value),
    coupon.maxDiscount == null ? null : asMoney(coupon.maxDiscount),
    subtotal,
  );

  if (couponDiscount > 0 && couponDiscount >= bestPromotion.discount) {
    return {
      discount: couponDiscount,
      couponId: coupon.id,
      promotionId: null,
      usageLimit: coupon.usageLimit,
      usageLimitPerUser: coupon.usageLimitPerUser,
      source: "COUPON",
      label: coupon.code,
    };
  }

  return bestPromotion;
};

const buildSlug = async (name: string, requestedSlug?: string): Promise<string> => {
  const slug = slugify(requestedSlug ?? name);

  if (!slug) {
    throw AppError.badRequest("Promotion name cannot be turned into a slug");
  }

  if (requestedSlug) {
    return slug;
  }

  const existing = await prisma.promotion.findUnique({
    where: { slug },
    select: { id: true },
  });

  return existing ? `${slug.slice(0, 174)}-${Math.random().toString(36).slice(2, 6)}` : slug;
};

const getActivePromotions = async () => {
  return cacheGetOrSet("content", "promotions:active", CATALOG_CACHE_TTL_SECONDS, async () => {
    const now = new Date();
    const promotions = await prisma.promotion.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      include: promotionInclude,
    });

    return promotions.map(present);
  });
};

const getPromotions = async (query: PromotionListQuery) => {
  const skip = (query.page - 1) * query.limit;
  const [items, total] = await prisma.$transaction([
    prisma.promotion.findMany({
      skip,
      take: query.limit,
      orderBy: { createdAt: "desc" },
      include: promotionInclude,
    }),
    prisma.promotion.count(),
  ]);

  return {
    items: items.map(present),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

const createPromotion = async (input: CreatePromotionInput) => {
  await assertIds("product", input.productIds);
  await assertIds("category", input.categoryIds);
  await assertIds("brand", input.brandIds);

  const scope = input.scope ?? "ORDER";
  const slug = await buildSlug(input.name, input.slug);

  try {
    const promotion = await prisma.promotion.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        type: input.type,
        value: input.value,
        scope,
        minOrderAmount: input.minOrderAmount,
        maxDiscount: input.maxDiscount,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        isActive: input.isActive ?? true,
        priority: input.priority ?? 0,
        ...(scope === "PRODUCT"
          ? { products: { create: [...new Set(input.productIds ?? [])].map((productId) => ({ productId })) } }
          : {}),
        ...(scope === "CATEGORY"
          ? {
              categories: {
                create: [...new Set(input.categoryIds ?? [])].map((categoryId) => ({ categoryId })),
              },
            }
          : {}),
        ...(scope === "BRAND"
          ? { brands: { create: [...new Set(input.brandIds ?? [])].map((brandId) => ({ brandId })) } }
          : {}),
      },
      include: promotionInclude,
    });

    await invalidateCache("content");
    return present(promotion);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw AppError.conflict("A promotion with this slug already exists");
    }

    throw error;
  }
};

const updatePromotion = async (id: string, input: UpdatePromotionInput) => {
  const existing = await prisma.promotion.findUnique({
    where: { id },
    select: { id: true, scope: true, startsAt: true, endsAt: true, type: true },
  });

  if (!existing) {
    throw new NotFoundError("Promotion not found");
  }

  const nextStart = input.startsAt ?? existing.startsAt;
  const nextEnd = input.endsAt ?? existing.endsAt;

  if (nextEnd <= nextStart) {
    throw AppError.badRequest("endsAt must be after startsAt");
  }

  if ((input.type ?? existing.type) === "PERCENTAGE" && input.value != null && input.value > 100) {
    throw AppError.badRequest("Percentage discount cannot exceed 100");
  }

  await assertIds("product", input.productIds);
  await assertIds("category", input.categoryIds);
  await assertIds("brand", input.brandIds);

  const scope = input.scope ?? existing.scope;
  const links =
    scope === "ORDER"
      ? {
          products: { deleteMany: {} },
          categories: { deleteMany: {} },
          brands: { deleteMany: {} },
        }
      : {
          ...(input.productIds
            ? {
                products: {
                  deleteMany: {},
                  create: [...new Set(input.productIds)].map((productId) => ({ productId })),
                },
              }
            : {}),
          ...(input.categoryIds
            ? {
                categories: {
                  deleteMany: {},
                  create: [...new Set(input.categoryIds)].map((categoryId) => ({ categoryId })),
                },
              }
            : {}),
          ...(input.brandIds
            ? {
                brands: {
                  deleteMany: {},
                  create: [...new Set(input.brandIds)].map((brandId) => ({ brandId })),
                },
              }
            : {}),
        };

  try {
    const promotion = await prisma.promotion.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.value !== undefined ? { value: input.value } : {}),
        ...(input.scope !== undefined ? { scope: input.scope } : {}),
        ...(input.minOrderAmount !== undefined ? { minOrderAmount: input.minOrderAmount } : {}),
        ...(input.maxDiscount !== undefined ? { maxDiscount: input.maxDiscount } : {}),
        ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...links,
      },
      include: promotionInclude,
    });

    await invalidateCache("content");
    return present(promotion);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw AppError.conflict("A promotion with this slug already exists");
    }

    throw error;
  }
};

const deletePromotion = async (id: string) => {
  try {
    await prisma.promotion.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("Promotion not found");
    }

    throw error;
  }

  await invalidateCache("content");
};

const quoteCart = async (
  owner: { kind: "user"; userId: string } | { kind: "guest"; sessionId: string },
  couponCode?: string,
) => {
  if (owner.kind === "guest" && couponCode) {
    throw AppError.badRequest("Sign in to use a coupon");
  }

  const cart = await prisma.cart.findUnique({
    where: owner.kind === "user" ? { userId: owner.userId } : { sessionId: owner.sessionId },
    include: {
      items: {
        include: {
          variant: {
            select: {
              price: true,
              product: { select: { id: true, categoryId: true, brandId: true, basePrice: true } },
            },
          },
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    throw AppError.badRequest("Your cart is empty");
  }

  const lines = cart.items.map((item) => {
    const unitPrice = asMoney(item.variant.price ?? item.variant.product.basePrice);

    return {
      productId: item.variant.product.id,
      categoryId: item.variant.product.categoryId,
      brandId: item.variant.product.brandId,
      lineTotal: money(unitPrice * item.quantity),
    };
  });
  const subtotal = money(lines.reduce((total, line) => total + line.lineTotal, 0));
  const decision = await chooseDiscount(
    prisma,
    owner.kind === "user" ? owner.userId : "",
    lines,
    couponCode,
  );

  return {
    subtotal,
    discount: decision.discount,
    total: money(subtotal - decision.discount),
    applied:
      decision.source == null
        ? null
        : {
            source: decision.source,
            label: decision.label,
            discount: decision.discount,
          },
  };
};

export const promotionService = {
  getActivePromotions,
  getPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  quoteCart,
};
