import { FormEvent, useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ApiError, api } from "../api";
import { UserFace } from "../components/Chrome";
import { DetailSkeleton, RowsSkeleton, SkeletonBlock } from "../components/Skeleton";
import { money, titleCaseStatus } from "../format";
import { useAuth, useStore } from "../state";
import type { AdminOrder, DashboardOverview, PageMeta, ProductCardData, StoreReturn } from "../types";

const STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURN_REQUESTED",
  "PARTIALLY_RETURNED",
  "RETURNED",
] as const;

const NEXT_STATUS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["RETURN_REQUESTED"],
  RETURN_REQUESTED: ["PARTIALLY_RETURNED", "RETURNED"],
  PARTIALLY_RETURNED: ["RETURNED"],
  RETURNED: [],
  CANCELLED: [],
};

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 ring-amber-200",
  CONFIRMED: "bg-sky-50 text-sky-800 ring-sky-200",
  PROCESSING: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  SHIPPED: "bg-violet-50 text-violet-800 ring-violet-200",
  DELIVERED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  CANCELLED: "bg-rose-50 text-rose-700 ring-rose-200",
  RETURN_REQUESTED: "bg-orange-50 text-orange-800 ring-orange-200",
  PARTIALLY_RETURNED: "bg-orange-50 text-orange-800 ring-orange-200",
  RETURNED: "bg-stone-100 text-stone-700 ring-stone-200",
  ACTIVE: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  DRAFT: "bg-amber-50 text-amber-800 ring-amber-200",
  ARCHIVED: "bg-stone-100 text-stone-700 ring-stone-200",
};

function when(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buyer(order: AdminOrder) {
  if (order.user) return `${order.user.firstName} ${order.user.lastName}`;
  return order.shippingFullName;
}

function buyerEmail(order: AdminOrder) {
  return order.user?.email ?? order.guestEmail ?? "Guest checkout";
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_TONE[status] ?? "bg-slate-100 text-slate-700 ring-slate-200"}`}>
      {titleCaseStatus(status)}
    </span>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV = [
  { to: "/admin", label: "Dashboard", end: true, icon: "M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" },
  { to: "/admin/products", label: "Products", end: false, icon: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8" },
  { to: "/admin/categories", label: "Categories", end: false, icon: "M4 5h7v7H4V5zm9 0h7v7h-7V5zM4 14h7v5H4v-5zm9 0h7v5h-7v-5z" },
  { to: "/admin/banners", label: "Banners", end: false, icon: "M4 6h16v12H4V6zm2 2v8l5-3 5 3V8H6z" },
  { to: "/admin/orders", label: "Orders", end: false, icon: "M6 6h15l-1.5 9h-12L6 6zM6 6 5 3H2" },
  { to: "/admin/variants", label: "Variants", end: false, icon: "M4 7h16M4 12h16M4 17h10" },
  { to: "/admin/catalog", label: "Brands & sizes", end: false, icon: "M4 6h16v12H4z" },
  { to: "/admin/coupons", label: "Coupons", end: false, icon: "M4 8h16v8H4z" },
  { to: "/admin/promotions", label: "Promotions", end: false, icon: "M12 3l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" },
  { to: "/admin/returns", label: "Returns", end: false, icon: "M4 12h10M10 8l4 4-4 4" },
  { to: "/admin/payments", label: "Payments", end: false, icon: "M3 7h18v10H3z" },
  { to: "/admin/delivery", label: "Delivery", end: false, icon: "M3 7h11v8H3zM14 10h4l3 3v2h-7z" },
  { to: "/admin/outlets", label: "Outlets", end: false, icon: "M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z" },
  { to: "/admin/pages", label: "Pages", end: false, icon: "M6 3h9l5 5v13H6z" },
  { to: "/admin/size-guides", label: "Size guides", end: false, icon: "M4 6h16M4 12h16M4 18h10" },
  { to: "/admin/newsletter", label: "Newsletter", end: false, icon: "M4 6h16v12H4zM4 7l8 6 8-6" },
  { to: "/admin/settings", label: "Settings", end: false, icon: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" },
];

export function AdminLayout() {
  const { user, ready, logout } = useAuth();
  const { settings } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const stored = localStorage.getItem("store_theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    localStorage.setItem("store_theme", theme);
  }, [theme]);

  if (!ready) {
    return <div className={`admin-theme-root grid min-h-screen place-items-center p-6 ${theme === "dark" ? "admin-theme-dark" : "admin-theme-light"}`}><div className="w-full max-w-xl"><RowsSkeleton rows={7} columns={2} /></div></div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.accountType !== "ADMIN") return <Navigate to="/" replace />;

  const title = NAV.find((link) => (link.end ? location.pathname === link.to : location.pathname.startsWith(link.to)))?.label ?? "Overview";
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

  return (
    <div className={`admin-theme-root min-h-screen p-2 antialiased sm:p-4 ${theme === "dark" ? "admin-theme-dark" : "admin-theme-light"}`}>
      <div className="admin-theme-panel relative flex min-h-[calc(100vh-1rem)] overflow-hidden rounded-[28px] shadow-[0_20px_50px_rgba(16,24,40,0.08)] sm:min-h-[calc(100vh-2rem)]">
        <aside className={`admin-theme-sidebar absolute inset-y-0 left-0 z-40 flex w-[232px] flex-col transition-transform lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center gap-3 px-5 pt-6 pb-5">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#2ec9a8] text-lg font-semibold text-white">
              {settings.storeName.slice(0, 1)}
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold text-slate-800">{settings.storeName}</span>
              <span className="block text-xs text-slate-400">Commerce</span>
            </span>
          </div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
            {NAV.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? "bg-[#2ec9a8] text-white shadow-sm" : "text-slate-500 hover:bg-white hover:text-slate-800"}`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon d={link.icon} />
                    <span className="flex-1">{link.label}</span>
                    {isActive ? <span aria-hidden="true">›</span> : null}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <Link to="/" className="mx-3 mb-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-white">
            <Icon d="M10 6 4 12l6 6M4 12h16" />
            View store
          </Link>
        </aside>
        {open ? <button type="button" className="absolute inset-0 z-30 bg-slate-900/30 lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="admin-theme-topbar flex items-center gap-3 px-4 pt-5 pb-2 sm:px-6">
            <button type="button" className="grid h-10 w-10 place-items-center rounded-xl bg-white text-slate-600 shadow-sm lg:hidden" aria-label="Menu" onClick={() => setOpen(true)}>
              <Icon d="M4 7h16M4 12h16M4 17h16" />
            </button>
            <h1 className="text-[22px] font-semibold tracking-tight text-slate-800">{title}</h1>
            <form
              className="relative mx-auto hidden w-full max-w-md md:block"
              onSubmit={(event) => {
                event.preventDefault();
                const term = query.trim();
                navigate(term ? `/admin/products?search=${encodeURIComponent(term)}` : "/admin/products");
              }}
            >
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                aria-label="Search products"
                className="h-11 w-full rounded-xl border border-transparent bg-white pr-11 pl-4 text-sm shadow-sm outline-none placeholder:text-slate-400"
              />
              <button type="submit" aria-label="Search" className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400">
                <Icon d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.3-4.3" />
              </button>
            </form>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} className="admin-theme-toggle grid h-10 w-10 place-items-center rounded-xl shadow-sm" onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}>
                <Icon d={theme === "dark" ? "M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" : "M20.4 15.4A8.5 8.5 0 0 1 8.6 3.6 8.6 8.6 0 1 0 20.4 15.4Z"} />
              </button>
              <span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
                <UserFace user={user} size={28} />
                <span className="hidden sm:inline">{user.firstName}</span>
              </span>
              <span className="hidden items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-slate-500 shadow-sm sm:inline-flex">
                <Icon d="M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1z" />
                {today}
              </span>
              <button
                type="button"
                aria-label="Log out"
                title={`${user.firstName} ${user.lastName}`}
                className="grid h-10 w-10 place-items-center rounded-xl bg-white text-slate-500 shadow-sm"
                onClick={() => {
                  logout().then(() => navigate("/login"));
                }}
              >
                <Icon d="M15 12H3M12 8l4 4-4 4M9 5h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9" />
              </button>
            </div>
          </header>
          <main className="px-4 pt-3 pb-6 sm:px-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

type Offer = {
  id: string;
  name: string;
  description: string | null;
  type?: string;
  value?: string | number;
  startsAt?: string;
  endsAt?: string;
};

function dayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function recentDays(count: number) {
  const days: Date[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let index = count - 1; index >= 0; index -= 1) {
    const day = new Date(start);
    day.setDate(start.getDate() - index);
    days.push(day);
  }
  return days;
}

function AreaChart({ points, labels }: { points: number[]; labels: string[] }) {
  const width = 560;
  const height = 150;
  const max = Math.max(...points, 1);
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const coords = points.map((point, index) => {
    const x = index * step;
    const y = height - 12 - (point / max) * (height - 28);
    return [x, y] as const;
  });
  const line = coords.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const fill = `${line} L${width},${height} L0,${height} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label="Revenue over the last 8 days">
        <defs>
          <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2ec9a8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#2ec9a8" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={fill} fill="url(#sales-fill)" />
        <path d={line} fill="none" stroke="#2ec9a8" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function StatusRing({ delivered, open }: { delivered: number; open: number }) {
  const total = delivered + open;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const outer = total === 0 ? 0 : delivered / total;
  const innerRadius = 36;
  const innerCirc = 2 * Math.PI * innerRadius;
  const inner = total === 0 ? 0 : open / total;
  return (
    <svg viewBox="0 0 160 160" className="h-44 w-44" role="img" aria-label="Delivered and open orders">
      <circle cx="80" cy="80" r={radius} fill="none" stroke="#e6e8ec" strokeWidth="14" />
      <circle
        cx="80"
        cy="80"
        r={radius}
        fill="none"
        stroke="#2ec9a8"
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={`${circumference * outer} ${circumference}`}
        transform="rotate(-90 80 80)"
      />
      <circle cx="80" cy="80" r={innerRadius} fill="none" stroke="#eceff3" strokeWidth="10" />
      <circle
        cx="80"
        cy="80"
        r={innerRadius}
        fill="none"
        stroke="#c5c9d1"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${innerCirc * inner} ${innerCirc}`}
        transform="rotate(-90 80 80)"
      />
    </svg>
  );
}

export function AdminOverview() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [returns, setReturns] = useState<StoreReturn[]>([]);
  const [returnNote, setReturnNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function load(showLoading = false) {
    if (showLoading) setLoading(true);
    Promise.all([
      api.dashboard().then(setOverview).catch((reason) => {
        setError(reason instanceof ApiError ? reason.message : "Could not load the dashboard");
      }),
      api.adminOrders({ page: 1, limit: 100 }).then((result) => setOrders(result.items)).catch(() => setOrders([])),
      api.promotions().then((items) => setOffers(items as Offer[])).catch(() => setOffers([])),
      api.returns().then(setReturns).catch(() => setReturns([])),
    ]).finally(() => setLoading(false));
  }

  useEffect(() => {
    load(true);
    function onShow() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, []);

  const days = recentDays(8);
  const revenueByDay = days.map((day) => {
    const key = dayKey(day);
    return orders.reduce((sum, order) => {
      if (order.status === "CANCELLED") return sum;
      return dayKey(new Date(order.placedAt)) === key ? sum + Number(order.total) : sum;
    }, 0);
  });
  const windowRevenue = revenueByDay.reduce((sum, value) => sum + value, 0);
  const windowOrders = orders.filter((order) => order.status !== "CANCELLED" && days.some((day) => dayKey(day) === dayKey(new Date(order.placedAt)))).length;
  const average = windowOrders > 0 ? windowRevenue / windowOrders : 0;
  const delivered = overview?.ordersByStatus.DELIVERED ?? 0;
  const pendingDelivery = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED"].reduce(
    (sum, status) => sum + (overview?.ordersByStatus[status] ?? 0),
    0,
  );
  const sold = new Map<string, number>();
  for (const order of orders) {
    if (order.status === "CANCELLED") continue;
    for (const item of order.items) {
      sold.set(item.productName, (sold.get(item.productName) ?? 0) + item.quantity);
    }
  }
  const top = [...sold.entries()].sort((left, right) => right[1] - left[1]).slice(0, 4);
  const swatches = ["bg-[#e7f8f3]", "bg-[#eef2f6]", "bg-[#f8f1ea]", "bg-[#eef3fb]"];

  if (loading) return <RowsSkeleton rows={8} columns={2} />;

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon="M12 8c-2.2 0-4 .9-4 2.5S9.8 13 12 13s4 .9 4 2.5S14.2 18 12 18m0-14v2m0 12v2" tone="bg-[#e7f8f3] text-[#14a888]" label="Total Revenue" value={overview ? money(overview.totalRevenue) : "—"} hint="Paid orders" />
        <Metric icon="M4 7h16v11H4zM8 7V5h8v2" tone="bg-[#e8f1fb] text-[#3b82c4]" label="Total Order" value={overview ? String(overview.totalOrders) : "—"} hint="All statuses" />
        <Metric icon="M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 8v6M16 11h6" tone="bg-[#e9f8ef] text-[#22a06b]" label="Total Customer" value={overview ? String(overview.activeUsers) : "—"} hint="Active accounts" />
        <Metric icon="M3 7h11v8H3zM14 10h4l3 3v2h-7zM7 18a1.5 1.5 0 1 0 0.01 0M17 18a1.5 1.5 0 1 0 0.01 0" tone="bg-[#fff4e8] text-[#e08a2c]" label="Pending Delivery" value={overview ? String(pendingDelivery) : "—"} hint="Not delivered yet" />
      </section>
      <section className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Return requests</h2>
          <Link to="/admin/returns" className="text-sm font-medium text-[#14a888]">All returns</Link>
        </div>
        <label className="mt-3 block text-xs text-slate-500">
          Note for the next decision
          <input className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={returnNote} onChange={(event) => setReturnNote(event.target.value)} />
        </label>
        {returns.length === 0 ? <p className="mt-4 text-sm text-slate-500">No return requests yet.</p> : null}
        <ul className="mt-4 space-y-3">
          {returns.slice(0, 6).map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-3">
              <div>
                <p className="text-sm font-semibold">{item.order?.orderNumber ?? item.returnNumber ?? "Return"} · {titleCaseStatus(item.reason)}</p>
                <p className="text-xs text-slate-500">
                  {item.user ? `${item.user.firstName} ${item.user.lastName}` : "Customer"} · {titleCaseStatus(item.status)}
                  {item.items?.length ? ` · ${item.items.map((line) => line.orderItem?.productName).filter(Boolean).join(", ")}` : ""}
                </p>
              </div>
              {item.status === "REQUESTED" ? (
                <div className="flex gap-2">
                  <button type="button" className="rounded-lg bg-[#2ec9a8] px-3 py-1.5 text-xs font-semibold text-white" onClick={() => api.reviewReturn(item.id, { decision: "APPROVED", ...(returnNote ? { adminNote: returnNote } : {}) }).then(() => load())}>Approve</button>
                  <button type="button" className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700" onClick={() => api.reviewReturn(item.id, { decision: "REJECTED", ...(returnNote ? { adminNote: returnNote } : {}) }).then(() => load())}>Reject</button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.7fr_0.8fr]">
        <article className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Sales Analytic</h2>
            <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-500">Last 8 days</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-400">Revenue</p>
              <p className="mt-1 text-lg font-semibold">{money(windowRevenue)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Orders</p>
              <p className="mt-1 text-lg font-semibold">{windowOrders}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Average</p>
              <p className="mt-1 text-lg font-semibold">{money(average)}</p>
            </div>
          </div>
          <div className="mt-4">
            <AreaChart
              points={revenueByDay}
              labels={days.map((day) => day.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }))}
            />
          </div>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <h2 className="text-base font-semibold">Sales Target</h2>
          <div className="mt-4 flex justify-center">
            <StatusRing delivered={delivered} open={pendingDelivery} />
          </div>
          <div className="mt-2 space-y-2 text-sm">
            <p className="flex items-center justify-between text-slate-500">
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#c5c9d1]" /> Open orders</span>
              <span className="font-semibold text-slate-800">{pendingDelivery}</span>
            </p>
            <p className="flex items-center justify-between text-slate-500">
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#2ec9a8]" /> Delivered</span>
              <span className="font-semibold text-slate-800">{delivered}</span>
            </p>
          </div>
        </article>
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.7fr_0.8fr]">
        <article className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Top Selling Products</h2>
            <Link to="/admin/products" className="grid h-8 w-8 place-items-center rounded-full bg-slate-50 text-slate-500" aria-label="All products">›</Link>
          </div>
          {top.length === 0 ? <p className="mt-6 text-sm text-slate-500">No sold products yet.</p> : null}
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {top.map(([name, quantity], index) => (
              <div key={name} className="rounded-2xl border border-slate-100 p-3">
                <div className={`grid h-24 place-items-center rounded-xl text-lg font-semibold text-slate-400 ${swatches[index % swatches.length]}`}>
                  {name.slice(0, 1)}
                </div>
                <p className="mt-3 line-clamp-2 text-sm font-medium">{name}</p>
                <p className="mt-1 text-xs text-slate-400">{quantity} pcs</p>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <h2 className="text-base font-semibold">Current Offer</h2>
          {offers.length === 0 ? <p className="mt-6 text-sm text-slate-500">No active offers.</p> : null}
          <ul className="mt-4 space-y-4">
            {offers.slice(0, 4).map((offer) => {
              const start = offer.startsAt ? new Date(offer.startsAt).getTime() : Date.now();
              const end = offer.endsAt ? new Date(offer.endsAt).getTime() : start;
              const span = Math.max(end - start, 1);
              const progress = Math.min(100, Math.max(8, ((Date.now() - start) / span) * 100));
              const label = offer.type === "PERCENTAGE" ? `${Number(offer.value)}% off` : offer.value != null ? money(offer.value) : offer.description;
              return (
                <li key={offer.id}>
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <p className="font-medium">{offer.name}</p>
                    <p className="shrink-0 text-xs text-slate-400">{offer.endsAt ? `Ends ${when(offer.endsAt)}` : "Active"}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{label}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[#2ec9a8]" style={{ width: `${progress}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </article>
      </section>
    </div>
  );
}

function Metric({ icon, tone, label, value, hint }: { icon: string; tone: string; label: string; value: string; hint: string }) {
  return (
    <article className="flex items-start justify-between rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-2 text-[26px] leading-none font-semibold tracking-tight text-slate-900">{value}</p>
        <p className="mt-2 text-xs text-slate-400">{hint}</p>
      </div>
      <span className={`grid h-10 w-10 place-items-center rounded-full ${tone}`}>
        <Icon d={icon} />
      </span>
    </article>
  );
}

function OrderTable({ orders }: { orders: AdminOrder[] }) {
  if (orders.length === 0) {
    return <p className="px-5 py-8 text-sm text-slate-500">No orders yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
          <tr>
            <th className="px-5 py-3 font-medium">Order</th>
            <th className="px-5 py-3 font-medium">Customer</th>
            <th className="px-5 py-3 font-medium">City</th>
            <th className="px-5 py-3 font-medium">Total</th>
            <th className="px-5 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-t border-slate-100">
              <td className="px-5 py-3.5">
                <Link to={`/admin/orders/${order.id}`} className="font-medium text-[#163a8a]">{order.orderNumber}</Link>
                <p className="text-xs text-slate-500">{when(order.placedAt)}</p>
              </td>
              <td className="px-5 py-3.5">
                <p className="font-medium text-slate-800">{buyer(order)}</p>
                <p className="text-xs text-slate-500">{buyerEmail(order)}</p>
              </td>
              <td className="px-5 py-3.5 text-slate-600">{order.shippingCity}</td>
              <td className="px-5 py-3.5 font-medium">{money(order.total)}</td>
              <td className="px-5 py-3.5"><StatusBadge status={order.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminOrders() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .adminOrders({ page, limit: 12, status: status || undefined })
      .then((result) => {
        setOrders(result.items);
        setMeta(result.meta);
        setError("");
      })
      .catch((reason) => setError(reason instanceof ApiError ? reason.message : "Could not load orders"))
      .finally(() => setLoading(false));
  }, [page, status]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{meta ? `${meta.total} orders` : loading ? <SkeletonBlock className="h-4 w-24" /> : ""}</p>
        </div>
        <label className="text-sm text-slate-600">
          Status
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
          >
            <option value="">All</option>
            {STATUSES.map((item) => (
              <option key={item} value={item}>{titleCaseStatus(item)}</option>
            ))}
          </select>
        </label>
      </div>
      {error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? <RowsSkeleton rows={6} columns={5} /> : <OrderTable orders={orders} />}
      </section>
      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm disabled:opacity-40">Previous</button>
          <span className="text-sm text-slate-500">{page} / {meta.totalPages}</span>
          <button type="button" disabled={page >= meta.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm disabled:opacity-40">Next</button>
        </div>
      ) : null}
    </div>
  );
}

export function AdminOrderDetail() {
  const { id = "" } = useParams();
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [error, setError] = useState("");
  const [next, setNext] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    api.order(id).then((item) => {
      setOrder(item);
      setNext("");
      setReason("");
    }).catch((reasonError) => setError(reasonError instanceof ApiError ? reasonError.message : "Order not found"));
  }, [id]);

  const options = order ? NEXT_STATUS[order.status] ?? [] : [];

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!order || !next) return;
    if (next === "CANCELLED" && reason.trim().length === 0) {
      setError("A cancel reason is required");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const updated = await api.updateOrderStatus(order.id, {
        status: next,
        ...(next === "CANCELLED" ? { cancelReason: reason.trim() } : {}),
      });
      setOrder(updated);
      setNext("");
      setReason("");
    } catch (reasonError) {
      setError(reasonError instanceof ApiError ? reasonError.message : "Could not update the order");
    } finally {
      setBusy(false);
    }
  }

  if (error && !order) return <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>;
  if (!order) return <DetailSkeleton />;

  return (
    <div className="space-y-5">
      <div>
        <Link to="/admin/orders" className="text-sm font-medium text-[#163a8a]">Back to orders</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{order.orderNumber}</h1>
          <StatusBadge status={order.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500">Placed {when(order.placedAt)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {order.paymentMethod === "COD" ? (
            <button
              type="button"
              className="rounded-xl bg-[#2ec9a8] px-3 py-2 text-sm font-semibold text-white"
              onClick={() => {
                api.collectCash(order.id).then(() => setNote("Cash collected")).catch((reasonError) => setError(reasonError instanceof ApiError ? reasonError.message : "Could not collect cash"));
              }}
            >
              Collect cash
            </button>
          ) : null}
          {order.user ? (
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              onClick={() => {
                api.user(order.user!.id).then((person) => setNote(`${person.firstName} ${person.lastName} · ${person.email}`)).catch((reasonError) => setError(reasonError instanceof ApiError ? reasonError.message : "Could not load the customer"));
              }}
            >
              View customer
            </button>
          ) : null}
        </div>
        {note ? <p className="mt-2 text-sm text-slate-600">{note}</p> : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Items</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{item.productName}</p>
                  <p className="text-xs text-slate-500">{item.sku} · Qty {item.quantity}</p>
                </div>
                <p className="font-medium">{money(item.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-2 space-y-1 border-t border-slate-100 pt-3 text-sm">
            <div className="flex justify-between text-slate-600"><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
            <div className="flex justify-between text-slate-600"><dt>Discount</dt><dd>{money(order.discountAmount)}</dd></div>
            <div className="flex justify-between text-slate-600"><dt>Shipping</dt><dd>{money(order.shippingAmount)}</dd></div>
            <div className="flex justify-between pt-1 text-base font-semibold"><dt>Total</dt><dd>{money(order.total)}</dd></div>
          </dl>
        </section>
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-sm">
            <h2 className="font-semibold">Customer</h2>
            <p className="mt-2 font-medium">{buyer(order)}</p>
            <p className="text-slate-500">{buyerEmail(order)}</p>
            <p className="mt-3 text-slate-700">{order.shippingPhone}</p>
            <p className="mt-1 text-slate-600">
              {order.shippingLine1}
              {order.shippingLine2 ? `, ${order.shippingLine2}` : ""}
              <br />
              {order.shippingCity}{order.shippingState ? `, ${order.shippingState}` : ""} {order.shippingPostalCode}
              <br />
              {order.shippingCountry}
            </p>
            {order.customerNote ? <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-slate-600">{order.customerNote}</p> : null}
            {order.cancelReason ? <p className="mt-3 text-rose-700">Cancelled: {order.cancelReason}</p> : null}
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Update status</h2>
            {options.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">This order cannot move further.</p>
            ) : (
              <form onSubmit={onSubmit} className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {options.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setNext(status)}
                      className={`rounded-full px-3 py-1.5 text-sm ring-1 ring-inset ${next === status ? "bg-[#163a8a] text-white ring-[#163a8a]" : "bg-white text-slate-700 ring-slate-200"}`}
                    >
                      {titleCaseStatus(status)}
                    </button>
                  ))}
                </div>
                {next === "CANCELLED" ? (
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    required
                    placeholder="Why is this order being cancelled?"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
                    rows={3}
                  />
                ) : null}
                {error ? <p className="text-sm text-rose-700">{error}</p> : null}
                <button type="submit" disabled={!next || busy} className="rounded-xl bg-[#163a8a] px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
                  {busy ? "Saving…" : "Save status"}
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

type AdminProduct = ProductCardData & {
  status?: string;
  variants?: { stock: number }[];
};

export function AdminProducts() {
  const [params] = useSearchParams();
  const search = params.get("search") ?? "";
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminProduct[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    api
      .products({ page, limit: 12, sort: "latest", search: search || undefined })
      .then((result) => {
        setItems(result.items as AdminProduct[]);
        setMeta(result.meta);
      })
      .catch((reason) => setError(reason instanceof ApiError ? reason.message : "Could not load products"))
      .finally(() => setLoading(false));
  }, [page, search]);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Catalog</h1>
          <p className="mt-1 text-sm text-slate-500">{search ? `Results for “${search}”` : meta ? `${meta.total} products` : loading ? <SkeletonBlock className="h-4 w-24" /> : ""}</p>
        </div>
        <Link to="/admin/products/new" className="rounded-xl bg-[#2ec9a8] px-4 py-2 text-sm font-semibold text-white">
          Add product
        </Link>
      </div>
      {error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Price</th>
                <th className="px-5 py-3 font-medium">Stock</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-5"><RowsSkeleton rows={6} columns={6} /></td></tr>
              ) : items.map((product) => {
                const stock = (product.variants ?? []).reduce((sum, variant) => sum + variant.stock, 0);
                return (
                  <tr key={product.id} className="border-t border-slate-100">
                    <td className="px-5 py-3.5">
                      <Link to={`/product/${product.id}`} className="font-medium text-[#163a8a]">{product.name}</Link>
                      <p className="text-xs text-slate-500">{product.brand?.name ?? ""}</p>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{product.category?.name ?? "—"}</td>
                    <td className="px-5 py-3.5 font-medium">{money(product.basePrice)}</td>
                    <td className="px-5 py-3.5 text-slate-600">{stock}</td>
                    <td className="px-5 py-3.5">{product.status ? <StatusBadge status={product.status} /> : "—"}</td>
                    <td className="px-5 py-3.5">
                      <Link to={`/admin/products/${product.id}/edit`} className="text-sm font-medium text-[#163a8a]">
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="ml-3 text-sm text-rose-700"
                        onClick={() => {
                          if (!window.confirm(`Delete ${product.name}?`)) return;
                          api.deleteProduct(product.id).then((result) => {
                            if (result.archived) {
                              setItems((current) => current.map((item) => item.id === product.id ? { ...item, status: "ARCHIVED" } : item));
                              setError(result.message);
                              return;
                            }
                            setItems((current) => current.filter((item) => item.id !== product.id));
                            setError("");
                          }).catch((reason) => setError(reason instanceof ApiError ? reason.message : "Could not delete the product"));
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && items.length === 0 && !error ? <p className="px-5 py-8 text-sm text-slate-500">No products yet.</p> : null}
      </section>
      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm disabled:opacity-40">Previous</button>
          <span className="text-sm text-slate-500">{page} / {meta.totalPages}</span>
          <button type="button" disabled={page >= meta.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm disabled:opacity-40">Next</button>
        </div>
      ) : null}
    </div>
  );
}
