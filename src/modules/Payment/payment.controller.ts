import type { Request, Response } from "express";
import { AppError } from "../../app/errors/AppError";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { paymentService } from "./payment.service";
import type { CreatePaymentIntentInput } from "./payment.validation";

const createIntent = async (
  req: ValidatedRequest<CreatePaymentIntentInput>,
  res: Response,
): Promise<void> => {
  if (!req.auth || req.auth.role !== "USER") {
    throw AppError.forbidden("Only customers can pay for an order");
  }

  const payment = await paymentService.createPaymentIntent(
    req.auth.id,
    req.validatedBody.orderId,
  );

  res.status(201).json({
    success: true,
    message: "Payment intent created",
    data: payment,
  });
};

const collectCash = async (
  req: ValidatedRequest<CreatePaymentIntentInput>,
  res: Response,
): Promise<void> => {
  const payment = await paymentService.collectCashOnDelivery(req.validatedBody.orderId);

  res.status(200).json({
    success: true,
    message: "Cash collected",
    data: payment,
  });
};

const createCheckout = async (
  req: ValidatedRequest<CreatePaymentIntentInput>,
  res: Response,
): Promise<void> => {
  if (!req.auth || req.auth.role !== "USER") {
    throw AppError.forbidden("Only customers can pay for an order");
  }

  const checkout = await paymentService.createCheckoutSession(
    req.auth.id,
    req.validatedBody.orderId,
  );

  res.status(201).json({
    success: true,
    message: "Checkout page created",
    data: checkout,
  });
};

const checkoutSuccess = async (req: Request, res: Response): Promise<void> => {
  const sessionId = typeof req.query.session_id === "string" ? req.query.session_id : "";
  let confirmed = false;

  if (sessionId) {
    try {
      confirmed = (await paymentService.confirmCheckoutSession(sessionId)) === "paid";
    } catch {
      confirmed = false;
    }
  }

  const title = confirmed ? "Payment confirmed" : "Payment received";
  const message = confirmed
    ? "The order is confirmed."
    : "Stripe accepted the card. The order is confirmed when the payment record is found.";

  res.status(200).type("html").send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
  </head>
  <body>
    <h1>${title}</h1>
    <p>${message}</p>
  </body>
</html>`);
};

const checkoutCancel = async (_req: Request, res: Response): Promise<void> => {
  res.status(200).type("html").send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Payment cancelled</title>
  </head>
  <body>
    <h1>Payment cancelled</h1>
    <p>No charge was made. You can open the checkout link again.</p>
  </body>
</html>`);
};

const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers["stripe-signature"];

  if (!Buffer.isBuffer(req.body)) {
    throw AppError.badRequest("Stripe webhook requires the raw request body");
  }

  if (typeof signature !== "string" || signature.length === 0) {
    throw AppError.badRequest("Missing Stripe signature");
  }

  const result = await paymentService.handleStripeWebhook(req.body, signature);

  res.status(200).json({
    success: true,
    ...result,
  });
};

export const paymentController = {
  createIntent,
  collectCash,
  createCheckout,
  checkoutSuccess,
  checkoutCancel,
  handleWebhook,
};
