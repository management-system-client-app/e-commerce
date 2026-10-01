import { Router } from "express";
import { authenticate, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { cartController } from "./cart.controller";
import { addCartItemSchema, cartItemParamSchema } from "./cart.validation";

const router = Router();

router.use(authenticate, authorize("USER"));

router.get("/", asyncHandler(cartController.getCart));

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
