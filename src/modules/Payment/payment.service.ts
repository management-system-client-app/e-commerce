import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { Prisma } from "../../../generated/prisma/client";
import { env } from "../../app/config/env";
import { prisma } from "../../app/config/prisma";
import { sendOrderConfirmationEmail, sendPaymentRejectedEmail } from "../../utils/emailSender";

type ManualPaymentProvider = "BKASH" | "NAGAD" | "ROCKET";
const manualPaymentProviders: ManualPaymentProvider[] = ["BKASH", "NAGAD", "ROCKET"];

const isManualPaymentProvider = (provider: string): provider is ManualPaymentProvider =>
  manualPaymentProviders.includes(provider as ManualPaymentProvider);
import { sendOrderMail } from "../../utils/orderMail";
import { AppError } from "../../app/errors/AppError";
import { NotFoundError } from "../../app/errors/NotFoundError";

let stripeClient: Stripe | undefined;

const getStripe = (): Stripe => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError("Stripe is not configured", 503);
  }

  stripeClient ??= new Stripe(env.STRIPE_SECRET_KEY);
  return stripeClient;
};

const toMinorUnits = (amount: Prisma.Decimal | number): number => {
  return Math.round(Number(amount) * 100);
};

const isCashOrder = async (orderId: string): Promise<boolean> => {
  const payment = await prisma.payment.findFirst({
    where: { orderId, provider: "COD" },
    select: { id: true },
  });

  return payment !== null;
};

const stripeErrorMessage = (error: unknown): string => {
  if (error instanceof Stripe.errors.StripeError) {
    return error.message;
  }

  return "Payment provider request failed";
};

const createPaymentIntent = async (userId: string, orderId: string) => {
  const stripe = getStripe();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payments: {
        where: { provider: "STRIPE" },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!order || order.userId !== userId) {
    throw new NotFoundError("Order not found");
  }

  if (await isCashOrder(order.id)) {
    throw AppError.badRequest("This order is cash on delivery");
  }

  if (order.status !== "PENDING") {
    throw AppError.badRequest("Only pending orders can be paid");
  }

  if (order.payments.some((payment) => payment.status === "PAID")) {
    throw AppError.conflict("This order is already paid");
  }

  const amount = toMinorUnits(order.total);

  if (amount < 1) {
    throw AppError.badRequest("Order total must be greater than zero");
  }

  const reusable = order.payments.find((payment) =>
    ["PENDING", "PROCESSING", "AUTHORIZED"].includes(payment.status),
  );

  const payment =
    reusable ??
    (await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: "STRIPE",
        status: "PENDING",
        amount: order.total,
        currency: order.currency,
        method: "card",
        idempotencyKey: randomUUID(),
      },
    }));

  if (payment.providerPaymentId) {
    const existingIntent = await stripe.paymentIntents.retrieve(payment.providerPaymentId);

    return {
      paymentId: payment.id,
      paymentIntentId: existingIntent.id,
      clientSecret: existingIntent.client_secret,
      amount,
      currency: order.currency,
      status: payment.status,
    };
  }

  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount,
        currency: order.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        metadata: {
          orderId: order.id,
          paymentId: payment.id,
        },
      },
      { idempotencyKey: payment.idempotencyKey ?? payment.id },
    );

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId: intent.id,
        status: intent.status === "requires_action" ? "AUTHORIZED" : "PENDING",
        metadata: {
          paymentIntentStatus: intent.status,
        },
      },
    });

    return {
      paymentId: payment.id,
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      amount,
      currency: order.currency,
      status: intent.status,
    };
  } catch (error) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        failureReason: stripeErrorMessage(error),
      },
    });

    if (error instanceof Stripe.errors.StripeAuthenticationError) {
      throw new AppError("Payment provider is not configured correctly", 503);
    }

    if (error instanceof Stripe.errors.StripeError) {
      throw AppError.badRequest(error.message);
    }

    throw error;
  }
};

const checkoutSessionIdOf = (metadata: Prisma.JsonValue): string | undefined => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }

  const value = metadata.checkoutSessionId;
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const appBaseUrl = (): string => {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;

  const vercelHost = process.env.VERCEL_URL?.trim().replace(/\/$/, "");
  if (vercelHost) return `https://${vercelHost}`;

  return `http://localhost:${env.PORT}`;
};

const createCheckoutSession = async (userId: string | null, orderId: string) => {
  const stripe = getStripe();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payments: {
        where: { provider: "STRIPE" },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!order || order.userId !== userId) {
    throw new NotFoundError("Order not found");
  }

  if (await isCashOrder(order.id)) {
    throw AppError.badRequest("This order is cash on delivery");
  }

  if (order.status !== "PENDING") {
    throw AppError.badRequest("Only pending orders can be paid");
  }

  if (order.payments.some((payment) => payment.status === "PAID")) {
    throw AppError.conflict("This order is already paid");
  }

  const amount = toMinorUnits(order.total);

  if (amount < 1) {
    throw AppError.badRequest("Order total must be greater than zero");
  }

  const reusable = order.payments.find((payment) =>
    ["PENDING", "PROCESSING", "AUTHORIZED"].includes(payment.status),
  );

  const payment =
    reusable ??
    (await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: "STRIPE",
        status: "PENDING",
        amount: order.total,
        currency: order.currency,
        method: "card",
        idempotencyKey: randomUUID(),
      },
    }));

  const existingSessionId = checkoutSessionIdOf(payment.metadata);

  if (existingSessionId) {
    const existing = await stripe.checkout.sessions.retrieve(existingSessionId);

    if (existing.status === "open" && existing.url) {
      return {
        paymentId: payment.id,
        url: existing.url,
        amount,
        currency: order.currency,
      };
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: order.id,
      success_url: `${appBaseUrl()}/api/v1/payments/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl()}/api/v1/payments/checkout/cancel`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: order.currency.toLowerCase(),
            unit_amount: amount,
            product_data: {
              name: `Order ${order.orderNumber}`,
            },
          },
        },
      ],
      metadata: {
        orderId: order.id,
        paymentId: payment.id,
      },
      payment_intent_data: {
        metadata: {
          orderId: order.id,
          paymentId: payment.id,
        },
      },
    });

    if (!session.url) {
      throw new AppError("Stripe did not return a checkout URL", 502);
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        metadata: {
          checkoutSessionId: session.id,
          checkoutStatus: session.status,
        },
      },
    });

    return {
      paymentId: payment.id,
      url: session.url,
      amount,
      currency: order.currency,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        failureReason: stripeErrorMessage(error),
      },
    });

    if (error instanceof Stripe.errors.StripeAuthenticationError) {
      throw new AppError("Payment provider is not configured correctly", 503);
    }

    if (error instanceof Stripe.errors.StripeError) {
      throw AppError.badRequest(error.message);
    }

    throw error;
  }
};

const recordWebhook = async (event: Stripe.Event, signature: string) => {
  const existing = await prisma.paymentWebhook.findUnique({
    where: {
      provider_eventId: {
        provider: "STRIPE",
        eventId: event.id,
      },
    },
  });

  if (existing?.status === "PROCESSED" || existing?.status === "IGNORED") {
    return existing;
  }

  const payload = {
    id: event.id,
    type: event.type,
    created: event.created,
  } satisfies Prisma.InputJsonObject;

  if (existing) {
    return prisma.paymentWebhook.update({
      where: { id: existing.id },
      data: {
        attemptCount: { increment: 1 },
        signature,
        payload,
        status: "RECEIVED",
        errorMessage: null,
      },
    });
  }

  return prisma.paymentWebhook.create({
    data: {
      provider: "STRIPE",
      eventId: event.id,
      eventType: event.type,
      payload,
      signature,
      status: "RECEIVED",
    },
  });
};

const applyPaymentIntent = async (
  intent: Stripe.PaymentIntent,
  outcome: "PAID" | "FAILED" | "CANCELLED",
): Promise<string | null> => {
  const payment = await prisma.payment.findFirst({
    where: {
      provider: "STRIPE",
      OR: [
        { providerPaymentId: intent.id },
        ...(intent.metadata.paymentId ? [{ id: intent.metadata.paymentId }] : []),
      ],
    },
    include: {
      order: { select: { id: true, status: true, paidAt: true } },
    },
  });

  if (!payment) {
    return null;
  }

  const chargeId =
    typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId: intent.id,
        transactionId: chargeId,
        status: outcome,
        failureReason:
          outcome === "FAILED" ? (intent.last_payment_error?.message ?? "Payment failed") : null,
        paidAt: outcome === "PAID" ? now : payment.paidAt,
      },
    });

    if (outcome === "PAID" && payment.order.status === "PENDING") {
      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          status: "CONFIRMED",
          paidAt: now,
        },
      });
    }
  });

  return payment.id;
};

const confirmCheckoutSession = async (
  sessionId: string,
): Promise<"paid" | "unpaid" | "missing"> => {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return "missing";
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    return "unpaid";
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!paymentIntentId) {
    return "unpaid";
  }

  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (!intent.metadata.paymentId && session.metadata?.paymentId) {
    intent.metadata.paymentId = session.metadata.paymentId;
  }

  const paymentId = await applyPaymentIntent(intent, "PAID");
  return paymentId ? "paid" : "missing";
};

const handleStripeWebhook = async (rawBody: Buffer, signature: string) => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new AppError("Stripe webhook secret is not configured", 503);
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      throw AppError.badRequest("Invalid Stripe signature");
    }

    throw error;
  }

  const webhook = await recordWebhook(event, signature);
  if (webhook.status === "PROCESSED" || webhook.status === "IGNORED") {
    return { received: true as const };
  }

  const handledEvents = new Set([
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "payment_intent.canceled",
    "checkout.session.completed",
  ]);

  try {
    if (!handledEvents.has(event.type)) {
      await prisma.paymentWebhook.update({
        where: { id: webhook.id },
        data: { status: "IGNORED", processedAt: new Date() },
      });
      return { received: true as const };
    }

    let intent: Stripe.PaymentIntent;
    let outcome: "PAID" | "FAILED" | "CANCELLED";

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;

      if (!paymentIntentId) {
        await prisma.paymentWebhook.update({
          where: { id: webhook.id },
          data: { status: "IGNORED", processedAt: new Date() },
        });
        return { received: true as const };
      }

      intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (!intent.metadata.paymentId && session.metadata?.paymentId) {
        intent.metadata.paymentId = session.metadata.paymentId;
      }
      outcome = "PAID";
    } else {
      intent = event.data.object as Stripe.PaymentIntent;
      outcome =
        event.type === "payment_intent.succeeded"
          ? "PAID"
          : event.type === "payment_intent.canceled"
            ? "CANCELLED"
            : "FAILED";
    }

    const paymentId = await applyPaymentIntent(intent, outcome);

    await prisma.paymentWebhook.update({
      where: { id: webhook.id },
      data: {
        status: paymentId ? "PROCESSED" : "IGNORED",
        processedAt: new Date(),
        errorMessage: paymentId ? null : "Payment record was not found",
        ...(paymentId ? { payment: { connect: { id: paymentId } } } : {}),
      },
    });

    return { received: true as const };
  } catch (error) {
    await prisma.paymentWebhook.update({
      where: { id: webhook.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Webhook processing failed",
      },
    });

    throw error;
  }
};

const collectCashOnDelivery = async (orderId: string) => {
  const payment = await prisma.payment.findFirst({
    where: { orderId, provider: "COD", status: "PENDING" },
    include: { order: { select: { id: true, status: true } } },
  });

  if (!payment) {
    throw new NotFoundError("Cash on delivery payment not found");
  }

  if (payment.order.status === "CANCELLED") {
    throw AppError.badRequest("Cancelled orders cannot be collected");
  }

  const paidAt = new Date();

  const [updated] = await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: "PAID", paidAt, method: "cash_on_delivery" },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { paidAt },
    }),
  ]);

  return updated;
};

const manualPaymentSelect = {
  id: true,
  provider: true,
  status: true,
  amount: true,
  currency: true,
  transactionId: true,
  failureReason: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      currency: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  },
} satisfies Prisma.PaymentSelect;

const phoneKey = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

type ManualBuyer =
  | { kind: "user"; userId: string; orderId: string }
  | { kind: "guest"; orderNumber: string; phone: string };

const submitManualPayment = async (buyer: ManualBuyer, transactionId: string) => {
  const payment = await prisma.payment.findFirst({
    where:
      buyer.kind === "user"
        ? {
            orderId: buyer.orderId,
            provider: { in: manualPaymentProviders },
            order: { userId: buyer.userId, status: "PENDING" },
          }
        : {
            provider: { in: manualPaymentProviders },
            order: {
              orderNumber: { equals: buyer.orderNumber, mode: "insensitive" },
              userId: null,
              status: "PENDING",
            },
          },
    orderBy: { createdAt: "desc" },
    include: { order: { select: { shippingPhone: true } } },
  });

  if (!payment) {
    throw new NotFoundError("Manual payment not found");
  }

  if (buyer.kind === "guest" && phoneKey(payment.order.shippingPhone) !== phoneKey(buyer.phone)) {
    throw new NotFoundError("Manual payment not found");
  }

  if (payment.status === "PAID") {
    throw AppError.badRequest("This order is already paid");
  }

  if (payment.status === "PROCESSING") {
    throw AppError.badRequest("A transaction id is already waiting for review");
  }

  if (payment.status !== "PENDING" && payment.status !== "FAILED") {
    throw AppError.badRequest("This payment cannot accept a transaction id");
  }

  const ownRejected =
    payment.metadata &&
    typeof payment.metadata === "object" &&
    !Array.isArray(payment.metadata) &&
    Array.isArray(payment.metadata.rejectedTransactionIds)
      ? payment.metadata.rejectedTransactionIds.filter((id): id is string => typeof id === "string")
      : [];

  if (ownRejected.includes(transactionId)) {
    throw AppError.conflict("This transaction id is already used");
  }

  const candidates = await prisma.payment.findMany({
    where: {
      id: { not: payment.id },
      OR: [
        { transactionId },
        { provider: { in: manualPaymentProviders }, status: "FAILED" },
      ],
    },
    select: { transactionId: true, metadata: true },
  });
  const alreadyUsed = candidates.some((candidate) => {
    if (candidate.transactionId === transactionId) {
      return true;
    }

    if (
      !candidate.metadata ||
      typeof candidate.metadata !== "object" ||
      Array.isArray(candidate.metadata) ||
      !Array.isArray(candidate.metadata.rejectedTransactionIds)
    ) {
      return false;
    }

    return candidate.metadata.rejectedTransactionIds.includes(transactionId);
  });

  if (alreadyUsed) {
    throw AppError.conflict("This transaction id is already used");
  }

  try {
    return await prisma.payment.update({
      where: { id: payment.id },
      data: {
        transactionId,
        status: "PROCESSING",
        failureReason: null,
      },
      select: manualPaymentSelect,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw AppError.conflict("This transaction id is already used");
    }

    throw error;
  }
};

const listManualPayments = async () => {
  return prisma.payment.findMany({
    where: {
      provider: { in: manualPaymentProviders },
      status: "PROCESSING",
    },
    orderBy: { updatedAt: "asc" },
    take: 100,
    select: manualPaymentSelect,
  });
};

const customerMail = (order: {
  guestEmail: string | null;
  shippingFullName: string;
  user: { email: string; firstName: string; lastName: string } | null;
}): { email: string; name: string } | null => {
  const email = order.user?.email ?? order.guestEmail;

  if (!email) {
    return null;
  }

  return {
    email,
    name: order.user
      ? `${order.user.firstName} ${order.user.lastName}`.trim()
      : order.shippingFullName,
  };
};

const approveManualPayment = async (paymentId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: {
        select: {
          id: true,
          status: true,
          orderNumber: true,
          total: true,
          currency: true,
          guestEmail: true,
          shippingFullName: true,
          user: { select: { firstName: true, lastName: true, email: true } },
          items: { select: { productName: true, quantity: true, lineTotal: true } },
        },
      },
    },
  });

  if (!payment || !isManualPaymentProvider(payment.provider)) {
    throw new NotFoundError("Manual payment not found");
  }

  if (payment.status !== "PROCESSING" || !payment.transactionId) {
    throw AppError.badRequest("This payment is not waiting for review");
  }

  if (payment.order.status !== "PENDING") {
    throw AppError.badRequest("Only a pending order can be approved");
  }

  const paidAt = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.payment.update({
      where: { id: payment.id },
      data: { status: "PAID", paidAt },
      select: manualPaymentSelect,
    });

    await tx.order.update({
      where: { id: payment.order.id },
      data: { status: "CONFIRMED", paidAt },
    });

    return saved;
  });

  const approvedMail = customerMail(payment.order);

  if (approvedMail) {
    const providerLabel = payment.provider === "BKASH" ? "bKash Personal" : payment.provider === "NAGAD" ? "Nagad" : "Rocket";
    await sendOrderMail(() =>
      sendOrderConfirmationEmail({
        to: approvedMail.email,
        customerName: approvedMail.name,
        orderNumber: payment.order.orderNumber,
        total: Number(payment.order.total),
        currency: payment.order.currency,
        paymentNote: `${providerLabel} payment approved. Transaction reference: ${payment.transactionId}.`,
        items: payment.order.items.map((item) => ({
          name: item.productName,
          quantity: item.quantity,
          lineTotal: Number(item.lineTotal),
        })),
      }),
    );
  }

  return updated;
};

const rejectManualPayment = async (paymentId: string, reason: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: {
        select: {
          orderNumber: true,
          status: true,
          guestEmail: true,
          shippingFullName: true,
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      },
    },
  });

  if (!payment || !isManualPaymentProvider(payment.provider)) {
    throw new NotFoundError("Manual payment not found");
  }

  if (payment.status !== "PROCESSING" || !payment.transactionId) {
    throw AppError.badRequest("This payment is not waiting for review");
  }

  if (payment.order.status !== "PENDING") {
    throw AppError.badRequest("Only a pending order can be rejected");
  }

  const metadata =
    payment.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata)
      ? payment.metadata
      : {};
  const previous = Array.isArray(metadata.rejectedTransactionIds)
    ? metadata.rejectedTransactionIds.filter((id): id is string => typeof id === "string")
    : [];

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "FAILED",
      failureReason: reason,
      transactionId: null,
      metadata: {
        ...metadata,
        rejectedTransactionIds: [...previous, payment.transactionId],
      },
    },
    select: manualPaymentSelect,
  });

  const rejectedMail = customerMail(payment.order);

  if (rejectedMail) {
    await sendOrderMail(() =>
      sendPaymentRejectedEmail({
        to: rejectedMail.email,
        customerName: rejectedMail.name,
        orderNumber: payment.order.orderNumber,
        reason,
      }),
    );
  }

  return updated;
};

export const paymentService = {
  createPaymentIntent,
  createCheckoutSession,
  collectCashOnDelivery,
  confirmCheckoutSession,
  handleStripeWebhook,
  submitManualPayment,
  listManualPayments,
  approveManualPayment,
  rejectManualPayment,
};
