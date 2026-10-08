import { Router } from "express";
import { authenticate, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { newsletterRateLimiter } from "../../app/middlewares/rateLimiter";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { newsletterController } from "./newsletter.controller";
import { newsletterIdParamSchema, subscribeNewsletterSchema } from "./newsletter.validation";

const router = Router();

router.post(
  "/",
  newsletterRateLimiter,
  validateRequest({ body: subscribeNewsletterSchema }),
  asyncHandler(newsletterController.subscribe),
);

router.get(
  "/",
  authenticate,
  authorize("ADMIN"),
  asyncHandler(newsletterController.getSubscribers),
);

router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateRequest({ params: newsletterIdParamSchema }),
  asyncHandler(newsletterController.removeSubscriber),
);

export const newsletterRoutes = router;
