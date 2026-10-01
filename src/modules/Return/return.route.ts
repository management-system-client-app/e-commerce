import { Router } from "express";
import { authenticate, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { returnController } from "./return.controller";
import {
  createReturnSchema,
  returnIdParamSchema,
  returnListQuerySchema,
  reviewReturnSchema,
} from "./return.validation";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize("USER"),
  validateRequest({ body: createReturnSchema }),
  asyncHandler(returnController.createReturn),
);

router.get(
  "/",
  authenticate,
  authorize("USER", "ADMIN"),
  validateRequest({ query: returnListQuerySchema }),
  asyncHandler(returnController.getReturns),
);

router.patch(
  "/:id/review",
  authenticate,
  authorize("ADMIN"),
  validateRequest({
    params: returnIdParamSchema,
    body: reviewReturnSchema,
  }),
  asyncHandler(returnController.reviewReturn),
);

router.get(
  "/:id",
  authenticate,
  authorize("USER", "ADMIN"),
  validateRequest({ params: returnIdParamSchema }),
  asyncHandler(returnController.getReturn),
);

export const returnRoutes = router;
