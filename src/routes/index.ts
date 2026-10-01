import { Router } from "express";
import { authRoutes } from "../modules/Auth/auth.route";
import { cartRoutes } from "../modules/Cart/cart.route";
import { orderRoutes } from "../modules/Order/order.route";
import { productRoutes } from "../modules/Product/product.route";
import { userRoutes } from "../modules/User/user.route";
import { variantRoutes } from "../modules/Variant/variant.route";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/products", productRoutes);
router.use("/variants", variantRoutes);
router.use("/cart", cartRoutes);
router.use("/orders", orderRoutes);

export default router;
