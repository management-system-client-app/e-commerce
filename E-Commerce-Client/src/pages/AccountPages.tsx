import { FormEvent, useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet as RouterOutlet, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ApiError, api } from "../api";
import { UserFace } from "../components/Chrome";
import { ProductGrid } from "../components/ProductCard";
import { DetailSkeleton, ProductGridSkeleton, RowsSkeleton } from "../components/Skeleton";
import { money, titleCaseStatus } from "../format";
import { useAuth, useCart } from "../state";
import type { CmsPage, Outlet, ProductCardData, SavedAddress, TrackedOrder } from "../types";

const OAUTH_TOKEN_KEY = "oauth_token";

export function AuthCallbackPage() {
  const { completeSession } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const failed = params.get("error");
    if (failed) {
      setError(failed);
      return;
    }
    const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token");
    if (fromHash) sessionStorage.setItem(OAUTH_TOKEN_KEY, fromHash);
    const token = fromHash || sessionStorage.getItem(OAUTH_TOKEN_KEY);
    if (!token) {
      setError("Login did not return a session");
      return;
    }
    window.history.replaceState(null, "", "/auth/callback");
    let active = true;
    completeSession(token)
      .then((account) => {
        sessionStorage.removeItem(OAUTH_TOKEN_KEY);
        if (!active) return;
        navigate(account.accountType === "ADMIN" ? "/admin" : "/", { replace: true });
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof ApiError ? reason.message : "Could not finish login");
      });
    return () => {
      active = false;
    };
  }, [completeSession, navigate]);

  return (
    <div className="auth">
      <h1 className="label">Login</h1>
      {error ? <p className="error">{error}</p> : <DetailSkeleton />}
      {error ? <p className="note"><Link to="/login">Back to login</Link></p> : null}
    </div>
  );
}

export function LoginPage() {
  const { user, ready, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const account = await login(email, password);
      navigate(account.accountType === "ADMIN" ? "/admin" : "/account");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Login failed");
    }
  }

  if (!ready) return null;
  if (user) return <Navigate to={user.accountType === "ADMIN" ? "/admin" : "/"} replace />;

  return (
    <form className="auth auth-layout auth-login" onSubmit={onSubmit}>
      <div className="auth-aside">
        <p className="auth-kicker">MEMBER ACCESS</p>
        <h1>Welcome back.</h1>
        <p>Pick up right where you left off.</p>
      </div>
      <div className="auth-form">
        <p className="label">ACCOUNT LOGIN</p>
        <h2>Sign in</h2>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn wide" type="submit">
          Login
        </button>
        <p className="note">
          New here? <Link to="/register">Create an account</Link>
          {" · "}
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
        <div className="auth-social">
          <a href={`${import.meta.env.VITE_API_URL ?? "http://localhost:5000/api/v1"}/auth/google`}>Google</a>
          <a href={`${import.meta.env.VITE_API_URL ?? "http://localhost:5000/api/v1"}/auth/facebook`}>Facebook</a>
        </div>
        <p className="note">Admin accounts sign in with this same form.</p>
      </div>
    </form>
  );
}

export function ForgotPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "code" | "password">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api.forgotPassword(email);
      try {
        await api.forgotAdminPassword(email);
      } catch {
        /* the customer email was already sent */
      }
      setStep("code");
      setNote("Check your email and enter the 6-digit code.");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not send the code");
    }
  }

  async function confirmCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api.verifyResetCode(email, code);
      setStep("password");
      setNote("Code accepted. Choose a new password.");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "That code is not valid");
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api.resetPassword({ email, code, password, confirmPassword });
      navigate("/login");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not change the password");
    }
  }

  return (
    <form className="auth" onSubmit={step === "email" ? sendCode : step === "code" ? confirmCode : changePassword}>
      <h1 className="label">Forgot password</h1>
      <div style={{ height: 16 }} />
      <label className="field">
        <span>Email</span>
        <input type="email" required value={email} readOnly={step !== "email"} onChange={(event) => setEmail(event.target.value)} />
      </label>
      {step !== "email" ? (
        <label className="field">
          <span>Code from email</span>
          <input required inputMode="numeric" minLength={6} maxLength={6} value={code} readOnly={step === "password"} onChange={(event) => setCode(event.target.value)} />
        </label>
      ) : null}
      {step === "password" ? (
        <>
          <label className="field">
            <span>New password</span>
            <input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label className="field">
            <span>Confirm password</span>
            <input type="password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </label>
        </>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {note ? <p className="note">{note}</p> : null}
      <button className="btn wide" type="submit">{step === "email" ? "Send code" : step === "code" ? "Submit code" : "Change password"}</button>
    </form>
  );
}

export function ResetPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: params.get("email") ?? "", code: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api.resetPassword(form);
      navigate("/login");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not reset the password");
    }
  }

  return (
    <form className="auth" onSubmit={onSubmit}>
      <h1 className="label">Reset password</h1>
      <div style={{ height: 16 }} />
      <label className="field"><span>Email</span><input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label className="field"><span>Code</span><input required minLength={6} maxLength={6} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label>
      <label className="field"><span>New password</span><input type="password" required minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
      <label className="field"><span>Confirm password</span><input type="password" required value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></label>
      {error ? <p className="error">{error}</p> : null}
      <button className="btn wide" type="submit">Reset</button>
    </form>
  );
}

export function RegisterPage() {
  const { user, ready, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await register({
        ...form,
        phone: form.phone || undefined,
        image: photo ?? undefined,
      });
      navigate("/account");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not register");
    }
  }

  if (!ready) return null;
  if (user) return <Navigate to="/" replace />;

  return (
    <form className="auth auth-layout auth-register" onSubmit={onSubmit}>
      <div className="auth-aside">
        <p className="auth-kicker">YOUR ACCOUNT</p>
        <h1>A fresh start.</h1>
        <p>Set up your profile and make checkout yours.</p>
      </div>
      <div className="auth-form">
        <p className="label">CREATE ACCOUNT</p>
        <h2>Join us</h2>
        {preview ? <img className="user-face auth-avatar" src={preview} alt="Profile preview" /> : <UserFace className="auth-avatar" user={{ firstName: form.firstName, email: form.email, avatarUrl: null }} size={72} />}
        <label className="field">
          <span>Profile photo</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setPhoto(file);
              setPreview((current) => {
                if (current) URL.revokeObjectURL(current);
                return file ? URL.createObjectURL(file) : "";
              });
            }}
          />
        </label>
        <div className="auth-name-grid">
          <label className="field">
            <span>First name</span>
            <input autoComplete="given-name" required value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
          </label>
          <label className="field">
            <span>Last name</span>
            <input autoComplete="family-name" required value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
          </label>
        </div>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </label>
        <label className="field">
          <span>Phone</span>
          <input type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        </label>
        <label className="field">
          <span>Confirm password</span>
          <input type="password" autoComplete="new-password" required value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn wide" type="submit">
          Create account
        </button>
        <p className="note">Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </form>
  );
}

export function WishlistPage() {
  const { user, ready } = useAuth();
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setLoading(false);
      return;
    }
    api
      .wishlist()
      .then((items) => setProducts(items.map((item) => item.product)))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load wishlist"))
      .finally(() => setLoading(false));
  }, [ready, user]);

  if (!ready || loading) return <ProductGridSkeleton />;

  if (ready && !user) {
    return (
      <p className="empty">
        <Link to="/login">Login</Link> to see your wishlist.
      </p>
    );
  }

  return (
    <div>
      <div className="section-head">
        <h1>Wishlist</h1>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {!error && products.length === 0 ? <p className="empty">Sorry! No result.</p> : null}
      {products.length > 0 ? <ProductGrid products={products} /> : null}
    </div>
  );
}

export function TrackPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setOrder(null);
    setLoading(true);
    try {
      setOrder(await api.track(orderNumber, phone));
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Order not found");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="narrow">
      <h1 className="label">Order tracking</h1>
      <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
        <label className="field">
          <span>Order number</span>
          <input required value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} />
        </label>
        <label className="field">
          <span>Phone</span>
          <input required minLength={7} value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn" type="submit">
          Track
        </button>
      </form>
      {loading ? <RowsSkeleton rows={3} /> : null}
      {order ? (
        <div style={{ marginTop: 20 }}>
          <p>
            {order.orderNumber} · {titleCaseStatus(order.status)}
          </p>
          <p>{money(order.total)}</p>
          {order.items.map((item) => (
            <div className="line" key={item.sku + item.productName}>
              {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <div className="photo-fallback" />}
              <div>
                <h3>{item.productName}</h3>
                <p className="note">
                  {item.size} {item.color} · × {item.quantity}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function OutletsPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.outlets().then(setOutlets).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Could not load outlets");
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="label">Outlets</h1>
      {error ? <p className="error">{error}</p> : null}
      {loading ? <RowsSkeleton rows={4} /> : null}
      {!loading && !error && outlets.length === 0 ? <p className="note">No outlets available.</p> : null}
      {!loading && outlets.map((outlet) => (
        <article key={outlet.id} className="outlet">
          <h2>{outlet.name}</h2>
          <p>
            {outlet.address}, {outlet.city}
          </p>
          <p>{outlet.phone}</p>
          {outlet.hours ? <p className="note">{outlet.hours}</p> : null}
          {outlet.mapUrl ? (
            <a href={outlet.mapUrl} target="_blank" rel="noreferrer">
              Map
            </a>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function CmsPageView() {
  const { slug = "" } = useParams();
  const [page, setPage] = useState<CmsPage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPage(null);
    setError("");
    setLoading(true);
    api
      .page(slug)
      .then(setPage)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Page not found"))
      .finally(() => setLoading(false));
  }, [slug]);

  if (error) return <p className="empty">{error}</p>;
  if (loading || !page) return <DetailSkeleton />;
  return (
    <article className="cms">
      <h1>{page.title}</h1>
      <div className="body">{page.body}</div>
    </article>
  );
}

export function ChangePasswordPage() {
  const { updateProfile } = useAuth();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [note, setNote] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setNote("");
    try {
      await updateProfile(form);
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setNote("Password changed");
    } catch (reason) {
      setNote(reason instanceof Error ? reason.message : "Could not change the password");
    }
  }

  return (
    <form style={{ marginTop: 24, maxWidth: 420 }} onSubmit={onSubmit}>
      <h1 className="label">Change password</h1>
      <label className="field">
        <span>Current password</span>
        <input type="password" required value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} />
      </label>
      <label className="field">
        <span>New password</span>
        <input type="password" required minLength={8} value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} />
      </label>
      <label className="field">
        <span>Confirm password</span>
        <input type="password" required value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} />
      </label>
      <button className="btn" type="submit">Change password</button>
      {note ? <p className="note">{note}</p> : null}
    </form>
  );
}

export function AccountLayout() {
  const { user, ready, logout } = useAuth();
  const navigate = useNavigate();
  if (!ready) {
    return (
      <div className="account-shell account-shell-loading" role="status" aria-label="Loading account">
        <aside className="account-side">
          <div className="account-loading-user" />
          <div className="account-loading-links">
            {Array.from({ length: 6 }, (_, index) => <div key={index} />)}
          </div>
        </aside>
        <div className="account-panel account-loading-panel">
          <div />
          <div />
          <div />
          <div />
        </div>
      </div>
    );
  }
  if (!user) return <LoginPage />;
  if (user.accountType === "ADMIN") return <Navigate to="/admin" replace />;

  return (
    <div className="account-shell">
      <aside className="account-side">
        <div className="account-who">
          <UserFace user={user} size={56} />
          <div>
            <strong>{user.firstName} {user.lastName}</strong>
            <p className="note">{user.email}</p>
          </div>
        </div>
        <p className="group">Manage My Account</p>
        <NavLink to="/account" end className={({ isActive }) => (isActive ? "on" : "")}>Profile</NavLink>
        <NavLink to="/account/address" className={({ isActive }) => (isActive ? "on" : "")}>Delivery address</NavLink>
        <NavLink to="/account/password" className={({ isActive }) => (isActive ? "on" : "")}>Change password</NavLink>
        <p className="group">My Orders</p>
        <NavLink to="/account/orders" className={({ isActive }) => (isActive ? "on" : "")}>Orders</NavLink>
        <NavLink to="/account/returns" className={({ isActive }) => (isActive ? "on" : "")}>Returns</NavLink>
        <p className="group">Saved</p>
        <NavLink to="/account/wishlist" className={({ isActive }) => (isActive ? "on" : "")}>Wishlist</NavLink>
        <button
          type="button"
          className="see-more"
          onClick={() => {
            logout().then(() => navigate("/"));
          }}
        >
          Logout
        </button>
      </aside>
      <div className="account-panel">
        <RouterOutlet />
      </div>
    </div>
  );
}

export function AccountProfile() {
  const { user, updateProfile, saveAvatar } = useAuth();
  const [profile, setProfile] = useState({ firstName: "", lastName: "", phone: "" });
  const [profileNote, setProfileNote] = useState("");

  useEffect(() => {
    if (!user) return;
    setProfile({ firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? "" });
  }, [user]);

  if (!user) return null;

  return (
    <div>
      <h1 className="label">Profile</h1>
      <UserFace user={user} size={72} />
      {user.accountType === "USER" ? (
        <label className="field" style={{ marginTop: 12 }}>
          <span>Profile photo</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setProfileNote("");
              saveAvatar(file).then(() => setProfileNote("Photo saved")).catch((reason: unknown) => setProfileNote(reason instanceof Error ? reason.message : "Could not save the photo"));
            }}
          />
        </label>
      ) : null}
      <form
        style={{ marginTop: 16, maxWidth: 420 }}
        onSubmit={(event) => {
          event.preventDefault();
          setProfileNote("");
          updateProfile({
            firstName: profile.firstName,
            lastName: profile.lastName,
            phone: profile.phone || null,
          }).then(() => setProfileNote("Profile saved")).catch((reason: unknown) => setProfileNote(reason instanceof Error ? reason.message : "Could not save"));
        }}
      >
        <label className="field"><span>First name</span><input required value={profile.firstName} onChange={(event) => setProfile({ ...profile, firstName: event.target.value })} /></label>
        <label className="field"><span>Last name</span><input required value={profile.lastName} onChange={(event) => setProfile({ ...profile, lastName: event.target.value })} /></label>
        <label className="field"><span>Phone</span><input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label>
        <button className="btn" type="submit">Save profile</button>
        {profileNote ? <p className="note">{profileNote}</p> : null}
      </form>
    </div>
  );
}

export function DeliveryAddressPage() {
  const [address, setAddress] = useState({
    fullName: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "Bangladesh",
  });
  const [addressNote, setAddressNote] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.defaultAddress().then((saved) => {
      if (!active || !saved) return;
      setAddress({
        fullName: saved.fullName,
        phone: saved.phone,
        line1: saved.line1,
        line2: saved.line2 ?? "",
        city: saved.city,
        state: saved.state ?? "",
        postalCode: saved.postalCode,
        country: saved.country,
      });
    }).catch(() => undefined).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <h1 className="label">Delivery address</h1>
      {loading ? <DetailSkeleton /> : (
      <form
        style={{ marginTop: 16, maxWidth: 420 }}
        onSubmit={(event) => {
          event.preventDefault();
          setAddressNote("");
          api.saveDefaultAddress({
            ...address,
            line2: address.line2 || null,
            state: address.state || null,
          }).then((saved: SavedAddress) => {
            setAddress({
              fullName: saved.fullName,
              phone: saved.phone,
              line1: saved.line1,
              line2: saved.line2 ?? "",
              city: saved.city,
              state: saved.state ?? "",
              postalCode: saved.postalCode,
              country: saved.country,
            });
            setAddressNote("Default address saved. It will be used at checkout.");
          }).catch((reason: unknown) => setAddressNote(reason instanceof Error ? reason.message : "Could not save address"));
        }}
      >
        <label className="field"><span>Full name</span><input required value={address.fullName} onChange={(event) => setAddress({ ...address, fullName: event.target.value })} /></label>
        <label className="field"><span>Phone</span><input required minLength={7} value={address.phone} onChange={(event) => setAddress({ ...address, phone: event.target.value })} /></label>
        <label className="field"><span>Address</span><input required value={address.line1} onChange={(event) => setAddress({ ...address, line1: event.target.value })} /></label>
        <label className="field"><span>Address line 2</span><input value={address.line2} onChange={(event) => setAddress({ ...address, line2: event.target.value })} /></label>
        <label className="field"><span>City</span><input required minLength={2} value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} /></label>
        <label className="field"><span>State</span><input value={address.state} onChange={(event) => setAddress({ ...address, state: event.target.value })} /></label>
        <label className="field"><span>Postal code</span><input required value={address.postalCode} onChange={(event) => setAddress({ ...address, postalCode: event.target.value })} /></label>
        <label className="field"><span>Country</span><input required value={address.country} onChange={(event) => setAddress({ ...address, country: event.target.value })} /></label>
        <button className="btn" type="submit">Save delivery address</button>
        {addressNote ? <p className="note">{addressNote}</p> : null}
      </form>
      )}
    </div>
  );
}

export function AccountOrders() {
  const [orders, setOrders] = useState<
    { id: string; orderNumber: string; status: string; total: string | number; placedAt: string; items?: { id: string; productName: string; quantity: number; lineTotal?: string | number }[] }[]
  >([]);
  const [ordersError, setOrdersError] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    api.orders().then(setOrders).catch((reason: unknown) => {
      setOrders([]);
      setOrdersError(reason instanceof Error ? reason.message : "Could not load orders");
    }).finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    function onShow() {
      if (document.visibilityState === "visible") load();
    }
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 15000);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);

  return (
    <div>
      <h1 className="label">My Orders</h1>
      {ordersError ? <p className="error">{ordersError}</p> : null}
      {loading ? <RowsSkeleton rows={4} /> : null}
      {!loading && orders.length === 0 && !ordersError ? <p className="note">No orders yet.</p> : null}
      <div className="order-list">
        {orders.map((order) => (
          <article className="receipt compact" key={order.id}>
            <p className="receipt-number">{order.orderNumber}</p>
            <p className="note">{titleCaseStatus(order.status)}</p>
            {(order.items ?? []).map((item) => (
              <div className="sub" key={item.id}>
                <span>{item.productName} × {item.quantity}</span>
                <span>{item.lineTotal != null ? money(item.lineTotal) : ""}</span>
              </div>
            ))}
            <div className="sub receipt-total"><strong>Total</strong><strong>{money(order.total)}</strong></div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function AccountReturns() {
  const [orders, setOrders] = useState<
    { id: string; orderNumber: string; status: string; items?: { id: string; productName: string }[] }[]
  >([]);
  const [returns, setReturns] = useState<{ id: string; status: string; reason: string; order?: { orderNumber: string } }[]>([]);
  const [returnOrder, setReturnOrder] = useState("");
  const [returnItem, setReturnItem] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    Promise.all([
      api.orders().then(setOrders).catch(() => setOrders([])),
      api.returns().then(setReturns).catch(() => setReturns([])),
    ]).finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div>
      <h1 className="label">My Returns</h1>
      {loading ? <RowsSkeleton rows={3} /> : null}
      {!loading && returns.length === 0 ? <p className="note">No return requests yet.</p> : null}
      {!loading && returns.map((item) => (
        <article className="receipt compact" key={item.id}>
          <p className="receipt-number">{item.order?.orderNumber ?? "Return"}</p>
          <p className="note">{titleCaseStatus(item.reason)} · {titleCaseStatus(item.status)}</p>
        </article>
      ))}
      <form
        style={{ maxWidth: 420, marginTop: 16 }}
        onSubmit={(event) => {
          event.preventDefault();
          setNote("");
          api.createReturn({
            orderId: returnOrder,
            type: "RETURN",
            reason: "CHANGED_MIND",
            ...(returnNote ? { note: returnNote } : {}),
            items: [{ orderItemId: returnItem, quantity: 1 }],
          }).then(() => {
            setReturnNote("");
            setNote("Return request sent");
            load();
          }).catch((reason: unknown) => setNote(reason instanceof Error ? reason.message : "Could not request the return"));
        }}
      >
        <label className="field">
          <span>Order</span>
          <select required value={returnOrder} onChange={(event) => { setReturnOrder(event.target.value); setReturnItem(""); }}>
            <option value="">Choose</option>
            {orders.filter((order) => order.status === "DELIVERED" || order.status === "RETURN_REQUESTED").map((order) => <option key={order.id} value={order.id}>{order.orderNumber}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Item</span>
          <select required value={returnItem} onChange={(event) => setReturnItem(event.target.value)}>
            <option value="">Choose</option>
            {(orders.find((order) => order.id === returnOrder)?.items ?? []).map((item) => (
              <option key={item.id} value={item.id}>{item.productName}</option>
            ))}
          </select>
        </label>
        <label className="field"><span>Note</span><input value={returnNote} onChange={(event) => setReturnNote(event.target.value)} /></label>
        <button className="btn" type="submit">Request return</button>
        {note ? <p className="note">{note}</p> : null}
      </form>
    </div>
  );
}

export function CartPage() {
  const { cart, remove, setQuantity, busy, loading } = useCart();
  return (
    <div className="narrow" style={{ maxWidth: 720 }}>
      <h1 className="label">Cart</h1>
      {loading ? <RowsSkeleton rows={3} /> : null}
      {!loading && cart.items.length === 0 ? <p className="empty">Your cart is empty.</p> : null}
      {!loading && cart.items.map((line) => (
        <div className="line" key={line.id}>
          {line.imageUrl ? <img src={line.imageUrl} alt="" /> : <div className="photo-fallback" />}
          <div>
            <Link to={`/product/${line.variant.product.id}`}>
              <h3>{line.variant.product.name}</h3>
            </Link>
            <p className="note">
              {line.variant.size.name}
              {line.variant.color ? ` / ${line.variant.color.name}` : ""} / {line.variant.fabric.name}
            </p>
            <p>{money(line.lineTotal)}</p>
            <div className="qty">
              <button type="button" disabled={busy} onClick={() => setQuantity(line, line.quantity - 1)}>
                −
              </button>
              <span>{line.quantity}</span>
              <button type="button" disabled={busy} onClick={() => setQuantity(line, line.quantity + 1)}>
                +
              </button>
            </div>
            <button type="button" className="note" onClick={() => remove(line.id)}>
              Remove
            </button>
          </div>
        </div>
      ))}
      {!loading && cart.items.length > 0 ? (
        <>
          <div className="sub" style={{ marginTop: 16 }}>
            <span>Subtotal</span>
            <strong>{money(cart.summary.subtotal)}</strong>
          </div>
          <Link to="/checkout" className="btn" style={{ display: "inline-grid", placeItems: "center", marginTop: 16 }}>
            Checkout
          </Link>
        </>
      ) : null}
    </div>
  );
}
