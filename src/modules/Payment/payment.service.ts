import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { Prisma } from "../../../generated/prisma/client";
import { env } from "../../app/config/env";
import { prisma } from "../../app/config/prisma";
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
  ]);

  try {
    if (!handledEvents.has(event.type)) {
      await prisma.paymentWebhook.update({
        where: { id: webhook.id },
        data: { status: "IGNORED", processedAt: new Date() },
      });
      return { received: true as const };
    }

    const intent = event.data.object as Stripe.PaymentIntent;
    const outcome =
      event.type === "payment_intent.succeeded"
        ? "PAID"
        : event.type === "payment_intent.canceled"
          ? "CANCELLED"
          : "FAILED";
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

export const paymentService = {
  createPaymentIntent,
  handleStripeWebhook,
};
