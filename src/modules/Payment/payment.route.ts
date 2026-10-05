import express, { Router } from "express";
import { authenticate, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { paymentController } from "./payment.controller";
import { createPaymentIntentSchema } from "./payment.validation";

const router = Router();

router.post(
  "/create-intent",
  authenticate,
  authorize("USER"),
  validateRequest({ body: createPaymentIntentSchema }),
  asyncHandler(paymentController.createIntent),
);

router.post(
  "/cod/collect",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ body: createPaymentIntentSchema }),
  asyncHandler(paymentController.collectCash),
);

router.post(
  "/checkout",
  authenticate,
  authorize("USER"),
  validateRequest({ body: createPaymentIntentSchema }),
  asyncHandler(paymentController.createCheckout),
);

router.get("/checkout/success", asyncHandler(paymentController.checkoutSuccess));
router.get("/checkout/cancel", asyncHandler(paymentController.checkoutCancel));

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  asyncHandler(paymentController.handleWebhook),
);

export const paymentRoutes = router;
