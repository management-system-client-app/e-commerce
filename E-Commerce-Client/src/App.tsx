import { useEffect, useLayoutEffect, useState } from "react";
import { Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Footer, Header } from "./components/Chrome";
import { AccountLayout, AccountOrders, AccountProfile, AccountReturns, AuthCallbackPage, CartPage, ChangePasswordPage, CmsPageView, DeliveryAddressPage, ForgotPage, LoginPage, OutletsPage, RegisterPage, ResetPage, TrackPage, WishlistPage } from "./pages/AccountPages";
import { AdminLayout, AdminOrderDetail, AdminOrders, AdminOverview, AdminProducts } from "./pages/AdminDashboard";
import { AdminBanners, AdminCategories } from "./pages/AdminCatalog";
import {
  AdminCatalogExtras,
  AdminCoupons,
  AdminDelivery,
  AdminNewsletter,
  AdminOutlets,
  AdminPages,
  AdminPayments,
  AdminPromotions,
  AdminReturns,
  AdminSettings,
  AdminSizeGuides,
  AdminVariants,
} from "./pages/AdminResources";
import { AdminProductForm } from "./pages/AdminProductForm";
import { CheckoutPage } from "./pages/CheckoutPage";
import { HomePage } from "./pages/HomePage";
import { ProductPage } from "./pages/ProductPage";
import { ShopPage } from "./pages/ShopPage";

function StoreShell() {
  const [theme] = useState<"light" | "dark">(() => {
    const stored = localStorage.getItem("store_theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    localStorage.setItem("store_theme", theme);
  }, [theme]);

  return (
    <div className={`store-shell theme-${theme}`}>
      <Header />
      <main className="page">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function RouteScrollReset() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export function App() {
  return (
    <>
      <RouteScrollReset />
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminOverview />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="orders/:id" element={<AdminOrderDetail />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="banners" element={<AdminBanners />} />
        <Route path="products/new" element={<AdminProductForm />} />
        <Route path="products/:id/edit" element={<AdminProductForm />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="coupons" element={<AdminCoupons />} />
        <Route path="promotions" element={<AdminPromotions />} />
        <Route path="catalog" element={<AdminCatalogExtras />} />
        <Route path="outlets" element={<AdminOutlets />} />
        <Route path="pages" element={<AdminPages />} />
        <Route path="delivery" element={<AdminDelivery />} />
        <Route path="newsletter" element={<AdminNewsletter />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="returns" element={<AdminReturns />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="size-guides" element={<AdminSizeGuides />} />
        <Route path="variants" element={<AdminVariants />} />
        </Route>
        <Route element={<StoreShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/women" element={<ShopPage />} />
        <Route path="/product/:id" element={<ProductPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPage />} />
        <Route path="/reset-password" element={<ResetPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/track" element={<TrackPage />} />
        <Route path="/outlets" element={<OutletsPage />} />
        <Route path="/account" element={<AccountLayout />}>
          <Route index element={<AccountProfile />} />
          <Route path="address" element={<DeliveryAddressPage />} />
          <Route path="password" element={<ChangePasswordPage />} />
          <Route path="orders" element={<AccountOrders />} />
          <Route path="returns" element={<AccountReturns />} />
          <Route path="wishlist" element={<WishlistPage />} />
        </Route>
        <Route path="/pages/:slug" element={<CmsPageView />} />
        <Route path="*" element={<p className="empty">Sorry! No result.</p>} />
        </Route>
      </Routes>
    </>
  );
}
