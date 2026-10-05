import { Router } from "express";
import { authRoutes } from "../modules/Auth/auth.route";
import { brandRoutes } from "../modules/Brand/brand.route";
import { cartRoutes } from "../modules/Cart/cart.route";
import { catalogRoutes } from "../modules/Catalog/catalog.route";
import { categoryRoutes } from "../modules/Category/category.route";
import { couponRoutes } from "../modules/Coupon/coupon.route";
import { dashboardRoutes } from "../modules/Dashboard/dashboard.route";
import { orderRoutes } from "../modules/Order/order.route";
import { paymentRoutes } from "../modules/Payment/payment.route";
import { productRoutes } from "../modules/Product/product.route";
import { returnRoutes } from "../modules/Return/return.route";
import { reviewRoutes } from "../modules/Review/review.route";
import { userRoutes } from "../modules/User/user.route";
import { variantRoutes } from "../modules/Variant/variant.route";

const router = Router();

router.use("/auth", authRoutes);
router.use("/catalog", catalogRoutes);
router.use("/brands", brandRoutes);
router.use("/categories", categoryRoutes);
router.use("/users", userRoutes);
router.use("/products", productRoutes);
router.use("/variants", variantRoutes);
router.use("/cart", cartRoutes);
router.use("/orders", orderRoutes);
router.use("/payments", paymentRoutes);
router.use("/returns", returnRoutes);
router.use("/reviews", reviewRoutes);
router.use("/coupons", couponRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;
