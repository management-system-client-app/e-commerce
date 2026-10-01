import { prisma } from "../../app/config/prisma";

const orderStatuses = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURN_REQUESTED",
  "PARTIALLY_RETURNED",
  "RETURNED",
] as const;

const getOverview = async () => {
  const [revenue, statusGroups, activeUsers] = await prisma.$transaction([
    prisma.order.aggregate({
      where: {
        paidAt: { not: null },
        status: { not: "CANCELLED" },
      },
      _sum: { total: true },
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
      orderBy: { status: "asc" },
    }),
    prisma.user.count({
      where: { isActive: true },
    }),
  ]);

  const ordersByStatus = Object.fromEntries(
    orderStatuses.map((status) => [status, 0]),
  ) as Record<(typeof orderStatuses)[number], number>;

  for (const group of statusGroups) {
    const count = group._count;

    if (typeof count === "number") {
      ordersByStatus[group.status] = count;
    } else if (typeof count === "object" && count !== null) {
      ordersByStatus[group.status] = count._all ?? 0;
    }
  }

  const totalOrders = Object.values(ordersByStatus).reduce((total, count) => total + count, 0);

  return {
    totalRevenue: Number(revenue._sum.total ?? 0),
    currency: "USD",
    totalOrders,
    ordersByStatus,
    activeUsers,
  };
};

export const dashboardService = {
  getOverview,
};
