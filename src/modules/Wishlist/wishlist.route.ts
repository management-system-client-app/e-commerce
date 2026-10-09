import { Router } from "express";
import { authenticate, authorize } from "../../app/middlewares/auth";
import { asyncHandler } from "../../app/middlewares/asyncHandler";
import { validateRequest } from "../../app/middlewares/validateRequest";
import { wishlistController } from "./wishlist.controller";
import { saveWishlistSchema, wishlistProductParamSchema } from "./wishlist.validation";

const router = Router();

router.use(authenticate, authorize("USER"));

router.get("/", asyncHandler(wishlistController.getWishlist));

router.post(
  "/",
  validateRequest({ body: saveWishlistSchema }),
  asyncHandler(wishlistController.saveProduct),
);

router.delete(
  "/:productId",
  validateRequest({ params: wishlistProductParamSchema }),
  asyncHandler(wishlistController.removeProduct),
);

export const wishlistRoutes = router;
