import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../app/config/prisma";
import { NotFoundError } from "../../app/errors/NotFoundError";

const subscriberSelect = {
  id: true,
  email: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NewsletterSubscriberSelect;

const subscribe = async (email: string) => {
  return prisma.newsletterSubscriber.upsert({
    where: { email },
    update: { isActive: true },
    create: { email },
    select: subscriberSelect,
  });
};

const getSubscribers = async () => {
  return prisma.newsletterSubscriber.findMany({
    orderBy: { createdAt: "desc" },
    select: subscriberSelect,
  });
};

const removeSubscriber = async (id: string) => {
  try {
    await prisma.newsletterSubscriber.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("Subscriber not found");
    }

    throw error;
  }
};

export const newsletterService = {
  subscribe,
  getSubscribers,
  removeSubscriber,
};
