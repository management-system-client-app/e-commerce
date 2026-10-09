import express, { Router } from "express";
import { authenticate, authenticateOptional, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { paymentController } from "./payment.controller";
import {
  createPaymentIntentSchema,
  manualPaymentIdParamSchema,
  rejectManualPaymentSchema,
  submitManualPaymentSchema,
} from "./payment.validation";

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

router.post(
  "/manual",
  authenticateOptional,
  validateRequest({ body: submitManualPaymentSchema }),
  asyncHandler(paymentController.submitManualPayment),
);

router.get(
  "/manual",
  authenticate,
  authorize("ADMIN"),
  asyncHandler(paymentController.listManualPayments),
);

router.post(
  "/manual/:id/approve",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ params: manualPaymentIdParamSchema }),
  asyncHandler(paymentController.approveManualPayment),
);

router.post(
  "/manual/:id/reject",
  authenticate,
  authorize("ADMIN"),
  validateRequest({
    params: manualPaymentIdParamSchema,
    body: rejectManualPaymentSchema,
  }),
  asyncHandler(paymentController.rejectManualPayment),
);

router.get("/checkout/success", asyncHandler(paymentController.checkoutSuccess));
router.get("/checkout/cancel", asyncHandler(paymentController.checkoutCancel));

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  asyncHandler(paymentController.handleWebhook),
);

export const paymentRoutes = router;
