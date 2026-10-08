import type {
  Cart,
  Catalog,
  Category,
  CmsPage,
  Color,
  AdminOrder,
  DashboardOverview,
  AdminHomeBlock,
  HomePayload,
  OrderResult,
  Outlet,
  PageMeta,
  ProductCardData,
  ProductDetail,
  Promotion,
  Review,
  Settings,
  SizeGuide,
  TrackedOrder,
  User,
  Brand,
  Size,
  Fabric,
  Coupon,
  CouponQuote,
  DeliveryZone,
  Subscriber,
  StoreReturn,
  ManualPayment,
  VariantRow,
} from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api/v1";
const TOKEN_KEY = "store_token";
const SESSION_KEY = "cart_session";

export class ApiError extends Error {
  status: number;
  errors?: { path: string; message: string }[];

  constructor(message: string, status: number, errors?: { path: string; message: string }[]) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

type Envelope<T> = {
  success: boolean;
  message?: string;
  data: T;
  meta?: PageMeta;
  errors?: { path: string; message: string }[];
};

export const sessionStore = {
  token: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string | null) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  },
  cartSession: () => localStorage.getItem(SESSION_KEY),
  setCartSession: (id: string | null) => {
    if (id) localStorage.setItem(SESSION_KEY, id);
    else localStorage.removeItem(SESSION_KEY);
  },
};

async function request<T>(path: string, init: RequestInit = {}): Promise<Envelope<T>> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = sessionStore.token();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const cartSession = sessionStore.cartSession();
  if (cartSession) headers.set("x-cart-session", cartSession);

  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  const body = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || !body || body.success === false) {
    if (response.status === 401) sessionStore.setToken(null);
    throw new ApiError(body?.message || "Request failed", response.status, body?.errors);
  }
  return body;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

const imageCache = new Map<string, string | null>();

export async function hydrateImages(products: ProductCardData[]): Promise<ProductCardData[]> {
  const missing = products.filter((product) => !product.images?.length && !product.imageUrl);
  await Promise.all(
    missing.map(async (product) => {
      if (imageCache.has(product.id)) return;
      try {
        const detail = await api.product(product.id);
        const url =
          detail.images.find((image) => image.isPrimary)?.url ?? detail.images[0]?.url ?? null;
        imageCache.set(product.id, url);
      } catch {
        imageCache.set(product.id, null);
      }
    }),
  );

  return products.map((product) => {
    if (product.images?.length || product.imageUrl) return product;
    const url = imageCache.get(product.id);
    return url ? { ...product, imageUrl: url } : product;
  });
}

export const api = {
  settings: () => request<Settings>("/settings").then((res) => res.data),
  catalog: () => request<Catalog>("/catalog").then((res) => res.data),
  categories: () =>
    request<Category[]>("/categories?limit=100&isActive=true").then((res) => res.data),
  adminCategories: () => request<Category[]>("/categories?limit=100").then((res) => res.data),
  saveCategory: (input: Record<string, unknown>, image?: File | null, id?: string) => {
    const body = new FormData();
    body.append("data", JSON.stringify(input));
    if (image) body.append("image", image);
    return request<Category>(id ? `/categories/${id}` : "/categories", {
      method: id ? "PATCH" : "POST",
      body,
    }).then((res) => res.data);
  },
  deleteCategory: (id: string) =>
    request<unknown>(`/categories/${id}`, { method: "DELETE" }).then((res) => res.data),
  homeBlocks: () => request<AdminHomeBlock[]>("/home/blocks").then((res) => res.data),
  saveHomeBlock: (input: Record<string, unknown>, image?: File | null, id?: string) => {
    const body = new FormData();
    body.append("data", JSON.stringify(input));
    if (image) body.append("image", image);
    return request<AdminHomeBlock>(id ? `/home/${id}` : "/home", {
      method: id ? "PATCH" : "POST",
      body,
    }).then((res) => res.data);
  },
  deleteHomeBlock: (id: string) =>
    request<unknown>(`/home/${id}`, { method: "DELETE" }).then((res) => res.data),
  home: () => request<HomePayload>("/home").then((res) => res.data),
  promotions: () => request<Promotion[]>("/promotions/active").then((res) => res.data),
  pages: () => request<CmsPage[]>("/pages").then((res) => res.data),
  page: (slug: string) => request<CmsPage>(`/pages/${encodeURIComponent(slug)}`).then((res) => res.data),
  outlets: () => request<Outlet[]>("/outlets").then((res) => res.data),
  products: (params: Record<string, string | number | boolean | undefined | null>) =>
    request<ProductCardData[]>(`/products${qs(params)}`).then((res) => ({
      items: res.data,
      meta: res.meta ?? { page: 1, limit: 20, total: res.data.length, totalPages: 1 },
    })),
  bestSellers: () => request<ProductCardData[]>("/products/best-sellers").then((res) => res.data),
  related: (id: string) =>
    request<ProductCardData[]>(`/products/${id}/related`).then((res) => res.data),
  product: (id: string) => request<ProductDetail>(`/products/${id}`).then((res) => res.data),
  createProduct: (input: Record<string, unknown>, images: File[]) => {
    const body = new FormData();
    body.append("data", JSON.stringify(input));
    for (const image of images) body.append("images", image);
    return request<ProductDetail>("/products", { method: "POST", body }).then((res) => res.data);
  },
  updateProduct: (id: string, input: Record<string, unknown>) =>
    request<ProductDetail>(`/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }).then((res) => res.data),
  colors: async (): Promise<Color[]> => {
    const found = new Map<string, Color>();
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages && page <= 4) {
      const res = await request<
        { color: Color | null }[]
      >(`/variants${qs({ limit: 100, page, isActive: true })}`);
      for (const variant of res.data) {
        if (variant.color) found.set(variant.color.id, variant.color);
      }
      totalPages = res.meta?.totalPages ?? 1;
      page += 1;
    }
    return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
  },
  reviews: (productId: string) =>
    request<Review[]>(`/reviews/products/${productId}`).then((res) => ({
      items: res.data,
      summary:
        (res as Envelope<Review[]> & { summary?: { count: number; averageRating: number } }).summary ?? {
          count: res.data.length,
          averageRating: 0,
        },
    })),
  createReview: (body: { productId: string; rating: number; title?: string; comment: string }) =>
    request<Review>("/reviews", { method: "POST", body: JSON.stringify(body) }).then((res) => res.data),
  sizeGuides: (categoryId: string) =>
    request<SizeGuide[]>(`/size-guides${qs({ categoryId })}`).then((res) => res.data),
  cart: () => request<Cart>("/cart").then((res) => res.data),
  addCartItem: (body: { variantId?: string; productId?: string; quantity: number }) =>
    request<Cart>("/cart/items", { method: "POST", body: JSON.stringify(body) }).then((res) => res.data),
  removeCartItem: (itemId: string) =>
    request<Cart>(`/cart/items/${itemId}`, { method: "DELETE" }).then((res) => res.data),
  choosePayment: (paymentMethod: Cart["paymentMethod"]) =>
    request<Cart>("/cart/payment", {
      method: "POST",
      body: JSON.stringify({ paymentMethod }),
    }).then((res) => res.data),
  quoteDelivery: (city: string, subtotal: number) =>
    request<{
      city: string;
      subtotal: number;
      shippingAmount: number;
      zoneName: string | null;
    }>(`/delivery-zones/quote${qs({ city, subtotal })}`).then((res) => res.data),
  quotePromotion: (couponCode?: string) =>
    request<{
      subtotal: number;
      discount: number;
      total: number;
      applied: { source: string; label: string; discount: number } | null;
    }>("/promotions/quote", {
      method: "POST",
      body: JSON.stringify(couponCode ? { couponCode } : {}),
    }).then((res) => res.data),
  placeOrder: (body: Record<string, string | undefined>) =>
    request<OrderResult>("/orders", {
      method: "POST",
      body: JSON.stringify(body),
    }).then((res) => res.data),
  submitManualPayment: (body: {
    orderId?: string;
    orderNumber?: string;
    phone?: string;
    transactionId: string;
  }) =>
    request<unknown>("/payments/manual", { method: "POST", body: JSON.stringify(body) }).then(
      (res) => res.data,
    ),
  track: (orderNumber: string, phone: string) =>
    request<TrackedOrder>(`/orders/track${qs({ orderNumber, phone })}`).then((res) => res.data),
  orders: () =>
    request<
      {
        id: string;
        orderNumber: string;
        status: string;
        total: string | number;
        subtotal?: string | number;
        shippingAmount?: string | number;
        discountAmount?: string | number;
        placedAt: string;
        currency: string;
        items?: { id: string; productName: string; quantity: number; lineTotal: string | number }[];
      }[]
    >("/orders").then((res) => res.data),
  dashboard: () => request<DashboardOverview>("/dashboard").then((res) => res.data),
  adminOrders: (params: { page?: number; limit?: number; status?: string }) =>
    request<AdminOrder[]>(`/orders${qs(params)}`).then((res) => ({
      items: res.data,
      meta: res.meta ?? { page: 1, limit: 20, total: res.data.length, totalPages: 1 },
    })),
  order: (id: string) => request<AdminOrder>(`/orders/${id}`).then((res) => res.data),
  updateOrderStatus: (id: string, body: { status: string; cancelReason?: string }) =>
    request<AdminOrder>(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }).then((res) => res.data),
  login: async (email: string, password: string) => {
    const body = JSON.stringify({ email, password });
    try {
      const customer = await request<{ token: string; user: User }>("/auth/login", {
        method: "POST",
        body,
      });
      return {
        token: customer.data.token,
        user: { ...customer.data.user, phone: customer.data.user.phone ?? null, accountType: "USER" as const },
      };
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      const admin = await request<{ token: string; user: User }>("/auth/admin/login", {
        method: "POST",
        body,
      });
      return {
        token: admin.data.token,
        user: {
          id: admin.data.user.id,
          firstName: admin.data.user.firstName,
          lastName: admin.data.user.lastName,
          email: admin.data.user.email,
          phone: null,
          avatarUrl: admin.data.user.avatarUrl ?? null,
          accountType: "ADMIN" as const,
        },
      };
    }
  },
  register: (body: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    confirmPassword: string;
    phone?: string;
  }) => request<User>("/users/register", { method: "POST", body: JSON.stringify(body) }).then((res) => res.data),
  me: () =>
    request<User>("/users/me").then((res) => ({
      ...res.data,
      phone: res.data.phone ?? null,
    })),
  logout: () => request<unknown>("/auth/logout", { method: "POST" }).then((res) => res.data),
  wishlist: () =>
    request<
      {
        id: string;
        product: ProductCardData;
      }[]
    >("/wishlist").then((res) => res.data),
  saveWishlist: (productId: string) =>
    request<unknown>("/wishlist", { method: "POST", body: JSON.stringify({ productId }) }).then(
      (res) => res.data,
    ),
  removeWishlist: (productId: string) =>
    request<unknown>(`/wishlist/${productId}`, { method: "DELETE" }).then((res) => res.data),
  subscribe: (email: string) =>
    request<unknown>("/newsletter", { method: "POST", body: JSON.stringify({ email }) }).then(
      (res) => res.data,
    ),
  forgotPassword: (email: string) =>
    request<unknown>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }).then((res) => res.data),
  forgotAdminPassword: (email: string) =>
    request<unknown>("/auth/admin/forgot-password", { method: "POST", body: JSON.stringify({ email }) }).then((res) => res.data),
  verifyResetCode: (email: string, code: string) =>
    request<unknown>("/auth/verify-reset-code", { method: "POST", body: JSON.stringify({ email, code }) }).then((res) => res.data),
  resetPassword: (body: { email: string; code: string; password: string; confirmPassword: string }) =>
    request<unknown>("/auth/reset-password", { method: "POST", body: JSON.stringify(body) }).then((res) => res.data),
  updateMe: (body: Record<string, unknown>) =>
    request<User>("/users/me", { method: "PATCH", body: JSON.stringify(body) }).then((res) => res.data),
  uploadAvatar: (image: File) => {
    const body = new FormData();
    body.append("data", JSON.stringify({}));
    body.append("image", image);
    return request<User>("/users/me", { method: "PATCH", body }).then((res) => res.data);
  },
  user: (id: string) => request<User>(`/users/${id}`).then((res) => res.data),
  brands: () => request<Brand[]>("/brands?limit=100").then((res) => res.data),
  createBrand: (body: Record<string, unknown>) =>
    request<Brand>("/brands", { method: "POST", body: JSON.stringify(body) }).then((res) => res.data),
  sizes: () => request<Size[]>("/catalog/sizes?limit=100").then((res) => res.data),
  createSize: (body: Record<string, unknown>) =>
    request<Size>("/catalog/sizes", { method: "POST", body: JSON.stringify(body) }).then((res) => res.data),
  fabrics: () => request<Fabric[]>("/catalog/fabrics?limit=100").then((res) => res.data),
  createFabric: (body: Record<string, unknown>) =>
    request<Fabric>("/catalog/fabrics", { method: "POST", body: JSON.stringify(body) }).then((res) => res.data),
  coupons: () => request<Coupon[]>("/coupons?limit=100").then((res) => res.data),
  coupon: (id: string) => request<Coupon>(`/coupons/${id}`).then((res) => res.data),
  saveCoupon: (body: Record<string, unknown>, id?: string) =>
    request<Coupon>(id ? `/coupons/${id}` : "/coupons", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(body),
    }).then((res) => res.data),
  deleteCoupon: (id: string) => request<unknown>(`/coupons/${id}`, { method: "DELETE" }).then((res) => res.data),
  applyCoupon: (code: string, orderId?: string) =>
    request<CouponQuote>("/coupons/apply", {
      method: "POST",
      body: JSON.stringify(orderId ? { code, orderId } : { code }),
    }).then((res) => res.data),
  adminPromotions: () => request<Promotion[]>("/promotions?limit=100").then((res) => res.data),
  savePromotion: (body: Record<string, unknown>, id?: string) =>
    request<Promotion>(id ? `/promotions/${id}` : "/promotions", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(body),
    }).then((res) => res.data),
  deletePromotion: (id: string) =>
    request<unknown>(`/promotions/${id}`, { method: "DELETE" }).then((res) => res.data),
  saveOutlet: (body: Record<string, unknown>, id?: string) =>
    request<Outlet>(id ? `/outlets/${id}` : "/outlets", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(body),
    }).then((res) => res.data),
  outlet: (id: string) => request<Outlet>(`/outlets/${id}`).then((res) => res.data),
  deleteOutlet: (id: string) => request<unknown>(`/outlets/${id}`, { method: "DELETE" }).then((res) => res.data),
  managePages: () => request<CmsPage[]>("/pages/manage").then((res) => res.data),
  savePage: (slug: string, body: { title: string; body: string; isActive?: boolean }) =>
    request<CmsPage>(`/pages/${encodeURIComponent(slug)}`, { method: "PUT", body: JSON.stringify(body) }).then((res) => res.data),
  deletePage: (slug: string) =>
    request<unknown>(`/pages/${encodeURIComponent(slug)}`, { method: "DELETE" }).then((res) => res.data),
  zones: () => request<DeliveryZone[]>("/delivery-zones").then((res) => res.data),
  zone: (id: string) => request<DeliveryZone>(`/delivery-zones/${id}`).then((res) => res.data),
  saveZone: (body: Record<string, unknown>, id?: string) =>
    request<DeliveryZone>(id ? `/delivery-zones/${id}` : "/delivery-zones", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(body),
    }).then((res) => res.data),
  deleteZone: (id: string) =>
    request<unknown>(`/delivery-zones/${id}`, { method: "DELETE" }).then((res) => res.data),
  subscribers: () => request<Subscriber[]>("/newsletter").then((res) => res.data),
  deleteSubscriber: (id: string) =>
    request<unknown>(`/newsletter/${id}`, { method: "DELETE" }).then((res) => res.data),
  updateSettings: (body: Partial<Settings>) =>
    request<Settings>("/settings", { method: "PUT", body: JSON.stringify(body) }).then((res) => res.data),
  returns: () => request<StoreReturn[]>("/returns?limit=100").then((res) => res.data),
  returnOne: (id: string) => request<StoreReturn>(`/returns/${id}`).then((res) => res.data),
  createReturn: (body: Record<string, unknown>) =>
    request<StoreReturn>("/returns", { method: "POST", body: JSON.stringify(body) }).then((res) => res.data),
  reviewReturn: (id: string, body: { decision: "APPROVED" | "REJECTED"; adminNote?: string }) =>
    request<StoreReturn>(`/returns/${id}/review`, { method: "PATCH", body: JSON.stringify(body) }).then((res) => res.data),
  manualPayments: () => request<ManualPayment[]>("/payments/manual").then((res) => res.data),
  approvePayment: (id: string) =>
    request<ManualPayment>(`/payments/manual/${id}/approve`, { method: "POST" }).then((res) => res.data),
  rejectPayment: (id: string, reason: string) =>
    request<ManualPayment>(`/payments/manual/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }).then((res) => res.data),
  collectCash: (orderId: string) =>
    request<unknown>("/payments/cod/collect", { method: "POST", body: JSON.stringify({ orderId }) }).then((res) => res.data),
  createPaymentIntent: (orderId: string) =>
    request<{ clientSecret?: string | null }>("/payments/create-intent", {
      method: "POST",
      body: JSON.stringify({ orderId }),
    }).then((res) => res.data),
  createCheckout: (orderId: string) =>
    request<{ url?: string | null }>("/payments/checkout", {
      method: "POST",
      body: JSON.stringify({ orderId }),
    }).then((res) => res.data),
  adminSizeGuides: () => request<SizeGuide[]>("/size-guides").then((res) => res.data),
  sizeGuide: (id: string) => request<SizeGuide>(`/size-guides/${id}`).then((res) => res.data),
  saveSizeGuide: (body: Record<string, unknown>, id?: string) =>
    request<SizeGuide>(id ? `/size-guides/${id}` : "/size-guides", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(body),
    }).then((res) => res.data),
  deleteSizeGuide: (id: string) =>
    request<unknown>(`/size-guides/${id}`, { method: "DELETE" }).then((res) => res.data),
  variants: (params: Record<string, string | number | boolean | undefined | null>) =>
    request<VariantRow[]>(`/variants${qs(params)}`).then((res) => res.data),
  variant: (id: string) => request<VariantRow>(`/variants/${id}`).then((res) => res.data),
  saveVariant: (body: Record<string, unknown>, id?: string) =>
    request<VariantRow>(id ? `/variants/${id}` : "/variants", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(body),
    }).then((res) => res.data),
  deleteVariant: (id: string) =>
    request<{ deactivated: boolean }>(`/variants/${id}`, { method: "DELETE" }).then((res) => ({
      deactivated: Boolean(res.data?.deactivated),
      message: res.message ?? "Variant deleted",
    })),
  deleteProduct: (id: string) =>
    request<{ archived: boolean }>(`/products/${id}`, { method: "DELETE" }).then((res) => ({
      archived: Boolean(res.data?.archived),
      message: res.message ?? "Product deleted",
    })),
};
