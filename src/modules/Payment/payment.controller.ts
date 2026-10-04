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
  handleWebhook,
};
