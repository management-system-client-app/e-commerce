import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../app/config/prisma";
import { AppError } from "../../app/errors/AppError";
import { NotFoundError } from "../../app/errors/NotFoundError";
import type { CreateReviewInput, ReviewListQuery } from "./review.validation";

const purchasedStatuses = [
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "RETURN_REQUESTED",
  "PARTIALLY_RETURNED",
  "RETURNED",
] as const;

const reviewSelect = {
  id: true,
  rating: true,
  title: true,
  comment: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
} satisfies Prisma.ReviewSelect;

const createReview = async (userId: string, input: CreateReviewInput) => {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { id: true, name: true },
  });

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  const purchase = await prisma.orderItem.findFirst({
    where: {
      variant: { productId: input.productId },
      order: {
        userId,
        status: { in: [...purchasedStatuses] },
      },
    },
    select: { id: true },
  });

  if (!purchase) {
    throw AppError.forbidden("You can review a product only after purchasing it");
  }

  const existing = await prisma.review.findUnique({
    where: {
      userId_productId: {
        userId,
        productId: input.productId,
      },
    },
    select: { id: true },
  });

  if (existing) {
    throw AppError.conflict("You have already reviewed this product");
  }

  try {
    return await prisma.review.create({
      data: {
        userId,
        productId: input.productId,
        rating: input.rating,
        title: input.title,
        comment: input.comment,
      },
      select: reviewSelect,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw AppError.conflict("You have already reviewed this product");
    }

    throw error;
  }
};

const getProductReviews = async (productId: string, query: ReviewListQuery) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  const where = { productId };
  const skip = (query.page - 1) * query.limit;

  const [items, total, summary] = await prisma.$transaction([
    prisma.review.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { createdAt: "desc" },
      select: reviewSelect,
    }),
    prisma.review.count({ where }),
    prisma.review.aggregate({
      where,
      _avg: { rating: true },
    }),
  ]);

  return {
    items,
    summary: {
      count: total,
      averageRating:
        summary._avg.rating === null ? 0 : Math.round(summary._avg.rating * 10) / 10,
    },
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const reviewService = {
  createReview,
  getProductReviews,
};
