import { FormEvent, useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { RowsSkeleton } from "./Skeleton";
import { money } from "../format";
import { categoryImage, useAuth, useCart, useStore } from "../state";
import type { Category, User } from "../types";

export function UserFace({ user, size = 32, className = "" }: { user: Pick<User, "firstName" | "email" | "avatarUrl">; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.4)) };
  if (user.avatarUrl) {
    return <img className={`user-face ${className}`} src={user.avatarUrl} alt="" style={style} />;
  }
  return (
    <span className={`user-face user-face-default ${className}`} style={style} role="img" aria-label="Default user avatar">
      <IconUser size={Math.max(13, Math.round(size * 0.58))} />
    </span>
  );
}

function IconSearch() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 16.5 20 20.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function IconHeart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 19s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9Z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function IconBag() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 8h12l-1 12H7L6 8Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 8V7a3 3 0 0 1 6 0v1" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function IconHome() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 11.5 12 4l8 7.5V20H4v-8.5Z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function IconGrid() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
function IconTracking() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="7.5" cy="18" r="1.7" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.5" cy="18" r="1.7" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function IconUser({ size = 18 }: { size?: number } = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 19.2c1.4-3 3.8-4.4 7-4.4s5.6 1.4 7 4.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function findNamed(categories: Category[], key: string) {
  const names = key === "women" ? ["women", "woman"] : [key];
  return categories.find((category) =>
    names.some(
      (name) =>
        category.slug === name ||
        category.name.toLowerCase() === name ||
        category.slug.startsWith(`${name}-`),
    ),
  );
}

export function useMenus() {
  const { catalog } = useStore();
  return useMemo(() => {
    const categories = catalog.categories;
    const roots = categories.filter((category) => !category.parentId);
    const kidsOf = (parent?: Category) =>
      parent ? categories.filter((category) => category.parentId === parent.id) : [];
    const toLinks = (list: Category[], gender?: string) => {
      const links = list.map((category) => ({
        href: `/shop?categoryId=${category.id}`,
        label: category.name,
      }));
      if (gender) links.unshift({ href: `/shop?gender=${gender}`, label: "Shop all" });
      return links;
    };
    const women = findNamed(categories, "women");
    const men = findNamed(categories, "men");
    const kids = findNamed(categories, "kids");
    const rootLinks = roots.map((category) => ({
      href: `/shop?categoryId=${category.id}`,
      label: category.name,
    }));
    return [
      { label: "Home", href: "/", items: rootLinks },
      { label: "Women", href: "/shop?gender=WOMEN", items: toLinks(kidsOf(women), "WOMEN") },
      { label: "Men", href: "/shop?gender=MEN", items: toLinks(kidsOf(men), "MEN") },
      { label: "Kids", href: "/shop?gender=KIDS", items: toLinks(kidsOf(kids), "KIDS") },
      { label: "Best Deals", href: "/shop", items: rootLinks },
    ];
  }, [catalog.categories]);
}

function navClass(href: string, isActive: boolean, pathname: string, search: string) {
  const url = new URL(href, "http://local");
  const here = new URLSearchParams(search);
  if (url.search) {
    const want = url.searchParams;
    const matched = pathname === url.pathname && [...want.keys()].every((key) => here.get(key) === want.get(key));
    return matched ? "on" : "";
  }
  if (url.pathname === "/shop") return pathname === "/shop" && here.toString() === "" ? "on" : "";
  return isActive ? "on" : "";
}

export function Header() {
  const { promo } = useStore();
  const { user } = useAuth();
  const { cart, setDrawer } = useCart();
  const menus = useMenus();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    const term = query.trim();
    navigate(term ? `/shop?search=${encodeURIComponent(term)}` : "/shop");
  }

  return (
    <>
      <header className={location.pathname === "/" ? "header home-header" : "header"}>
        {promo ? (
          <div className="promo">
            <Link to="/shop">{promo}</Link>
          </div>
        ) : null}
        <div className="topbar">
          <Link to="/" className="logo sara-logo" aria-label="SaRa Lifestyle home">
            <span className="sara-logo-main">SaRa</span>
            <span className="sara-logo-sub">LIFESTYLE</span>
          </Link>
          <Link to="/shop" className="header-marketplace">Marketplace</Link>
          <form onSubmit={onSearch} className="header-search">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="I'm shopping for ..." aria-label="Search products" />
            <button type="submit" aria-label="Search"><IconSearch /></button>
          </form>
          <div className="header-tools">
            <Link to="/wishlist" className="icon-btn" aria-label="Wishlist" title="Wishlist">
              <IconHeart />
            </Link>
            <button type="button" className="icon-btn" aria-label="Cart" onClick={() => setDrawer(true)}>
              <IconBag />
              {cart.summary.itemCount > 0 ? <span className="badge">{cart.summary.itemCount}</span> : null}
            </button>
            {user ? (
              <Link className="account-chip" to={user.accountType === "ADMIN" ? "/admin" : "/account"}>
                <UserFace user={user} />
                <span>{user.accountType === "ADMIN" ? "Dashboard" : user.firstName}</span>
              </Link>
            ) : (
              <span className="account-chip">
                <Link to="/login">Login</Link>
                <Link to="/register">Register</Link>
              </span>
            )}
          </div>
        </div>
        <nav className="category-nav" aria-label="Product categories">
          <button type="button" className="cat-btn" onClick={() => setMenuOpen(true)}>
            <IconGrid />
            <span>Shop by category</span>
          </button>
          <nav className="top-nav" aria-label="Shop">
            <NavLink to="/" end className={({ isActive }) => (isActive ? "on" : "")}>Home</NavLink>
            {menus.filter((item) => item.label !== "Home").map((item) => (
              <div className="menu-item" key={item.label}>
                <Link
                  to={item.href}
                  className={navClass(item.href, false, location.pathname, location.search)}
                  aria-current={navClass(item.href, false, location.pathname, location.search) ? "page" : undefined}
                >
                  {item.label}
                </Link>
                {item.items.length > 0 ? (
                  <div className="dropdown">
                    {item.items.map((child) => <Link key={child.href + child.label} to={child.href}>{child.label}</Link>)}
                  </div>
                ) : null}
              </div>
            ))}
          </nav>
          {location.pathname === "/" ? (
            <div className="category-nav-tools">
              <Link to="/track"><IconTracking />Order Tracking</Link>
            </div>
          ) : null}
        </nav>
      </header>
      <nav className="bottom-nav" aria-label="Mobile">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "on" : "")}>
          <IconHome />
          Home
        </NavLink>
        <button type="button" onClick={() => setMenuOpen(true)}>
          <IconGrid />
          Category
        </button>
        <NavLink to="/cart" className={({ isActive }) => (isActive ? "on" : "")}>
          <IconBag />
          Cart
        </NavLink>
        <NavLink to={user ? (user.accountType === "ADMIN" ? "/admin" : "/account") : "/login"} className={({ isActive }) => (isActive ? "on" : "")}>
          {user ? <UserFace user={user} size={22} /> : <IconUser />}
          Account
        </NavLink>
      </nav>
      {menuOpen ? (
        <>
          <button className="sheet-back" aria-label="Close category menu" onClick={() => setMenuOpen(false)} />
          <div className="sheet" role="dialog" aria-label="Category">
            <header>
              Category
              <button type="button" onClick={() => setMenuOpen(false)}>
                Close
              </button>
            </header>
            <div className="sheet-body menu-list">
              {menus.map((item) => (
                <div key={item.label}>
                  <Link to={item.href} onClick={() => setMenuOpen(false)}>
                    {item.label}
                  </Link>
                  <div className="sub-links">
                    {item.items.map((child) => (
                      <Link key={child.href + child.label} to={child.href} onClick={() => setMenuOpen(false)}>
                        {child.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
      <CartDrawer />
    </>
  );
}

function CartDrawer() {
  const { cart, drawer, setDrawer, remove, setQuantity, busy, loading } = useCart();
  if (!drawer) return null;
  return (
    <>
      <button className="drawer-back" aria-label="Close cart" onClick={() => setDrawer(false)} />
      <aside className="drawer" role="dialog" aria-label="Cart">
        <header>
          Cart
          <button type="button" onClick={() => setDrawer(false)}>
            Close
          </button>
        </header>
        <div className="drawer-body">
          {loading ? <RowsSkeleton rows={3} /> : null}
          {!loading && cart.items.length === 0 ? <p className="empty">Your cart is empty.</p> : null}
          {!loading && cart.items.map((line) => (
            <div className="line" key={line.id}>
              {line.imageUrl ? (
                <img src={line.imageUrl} alt="" />
              ) : (
                <div className="photo-fallback">Photo</div>
              )}
              <div>
                <h3>{line.variant.product.name}</h3>
                <p className="note">
                  {line.variant.size.name}
                  {line.variant.color ? ` / ${line.variant.color.name}` : ""} / {line.variant.fabric.name}
                </p>
                <p>{money(line.lineTotal)}</p>
                <div className="qty">
                  <button type="button" disabled={busy} onClick={() => setQuantity(line, line.quantity - 1)} aria-label="Decrease">
                    −
                  </button>
                  <span>{line.quantity}</span>
                  <button type="button" disabled={busy} onClick={() => setQuantity(line, line.quantity + 1)} aria-label="Increase">
                    +
                  </button>
                </div>
                <button type="button" className="note" onClick={() => remove(line.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <footer>
          <div className="sub">
            <span>Subtotal</span>
            <strong>{money(cart.summary.subtotal)}</strong>
          </div>
          <Link to="/cart" className="btn-line wide" style={{ display: "grid", placeItems: "center" }} onClick={() => setDrawer(false)}>
            View cart
          </Link>
          <Link to="/checkout" className="btn wide" style={{ display: "grid", placeItems: "center" }} onClick={() => setDrawer(false)}>
            Checkout
          </Link>
        </footer>
      </aside>
    </>
  );
}

export function Footer() {
  const { settings, settingsReady } = useStore();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      await api.subscribe(email);
      setEmail("");
      setMessage("You are on the list.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not subscribe");
    }
  }

  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <h3>Contact</h3>
          {!settingsReady ? <RowsSkeleton rows={3} /> : (
            <>
              {settings.address ? <p>{settings.address}</p> : null}
              {settings.supportPhone ? <a href={`tel:${settings.supportPhone}`}>{settings.supportPhone}</a> : null}
              {settings.supportEmail ? <a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a> : null}
              <div className="socials">
                {settings.facebookUrl ? <a href={settings.facebookUrl} target="_blank" rel="noreferrer">Facebook</a> : null}
                {settings.instagramUrl ? <a href={settings.instagramUrl} target="_blank" rel="noreferrer">Instagram</a> : null}
              </div>
            </>
          )}
        </div>
        <div>
          <h3>Company</h3>
          <Link to="/pages/about">About</Link>
          <Link to="/outlets">Outlets</Link>
        </div>
        <div>
          <h3>Help</h3>
          <Link to="/pages/shipping">Shipping</Link>
          <Link to="/pages/returns">Returns</Link>
          <Link to="/track">Order tracking</Link>
        </div>
        <div>
          <h3>Newsletter</h3>
          <form className="news" onSubmit={onSubmit}>
            <input
              type="email"
              required
              value={email}
              placeholder="Email"
              aria-label="Email"
              onChange={(event) => setEmail(event.target.value)}
            />
            <button type="submit">Join</button>
          </form>
          {message ? <p className="note">{message}</p> : null}
        </div>
      </div>
    </footer>
  );
}

export function categoryTiles(categories: Category[], images: Map<string, string | null>) {
  const roots = categories.filter((category) => !category.parentId);
  const source = roots.length > 0 ? roots : categories;
  return source.map((category) => ({
    category,
    image: categoryImage(images, category),
  }));
}
