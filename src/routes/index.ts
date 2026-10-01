import { Router } from "express";
import { authRoutes } from "../modules/Auth/auth.route";
import { productRoutes } from "../modules/Product/product.route";
import { userRoutes } from "../modules/User/user.route";
import { variantRoutes } from "../modules/Variant/variant.route";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/products", productRoutes);
router.use("/variants", variantRoutes);

export default router;
