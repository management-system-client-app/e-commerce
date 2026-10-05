import { Router } from "express";
import { authenticateOptional } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { cartController } from "./cart.controller";
import { addCartItemSchema, cartItemParamSchema, cartPaymentSchema } from "./cart.validation";

const router = Router();

router.use(authenticateOptional);

router.get("/", asyncHandler(cartController.getCart));

router.post(
  "/payment",
  validateRequest({ body: cartPaymentSchema }),
  asyncHandler(cartController.choosePayment),
);

router.post(
  "/items",
  validateRequest({ body: addCartItemSchema }),
  asyncHandler(cartController.addItem),
);

router.delete(
  "/items/:itemId",
  validateRequest({ params: cartItemParamSchema }),
  asyncHandler(cartController.removeItem),
);

export const cartRoutes = router;
