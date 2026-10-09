import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { ApiError, api } from "../api";
import { RowsSkeleton } from "../components/Skeleton";
import { titleCaseStatus } from "../format";
import { useAuth, useStore } from "../state";
import type { Catalog, Category, CmsPage, Coupon, DeliveryZone, ManualPayment, Outlet, Promotion, Settings, SizeGuide, StoreReturn, Subscriber, VariantRow } from "../types";

const field = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#2ec9a8]";

function messageOf(reason: unknown, fallback: string) {
  if (!(reason instanceof ApiError)) return fallback;
  const detail = reason.errors?.[0]?.message;
  return detail ? `${reason.message}. ${detail}` : reason.message;
}

function later(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function Panel({ title, error, children }: { title: string; error: string; children: ReactNode }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      {children}
      {error ? <p className="text-sm text-rose-700 lg:col-span-2">{error}</p> : null}
      <span className="sr-only">{title}</span>
    </div>
  );
}

export function AdminCoupons() {
  const [items, setItems] = useState<Coupon[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [type, setType] = useState("PERCENTAGE");
  const [value, setValue] = useState("10");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.coupons().then(setItems).catch((reason) => setError(messageOf(reason, "Could not load coupons"))).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = editing
        ? { type, value: Number(value) }
        : { code, type, value: Number(value), startsAt: new Date().toISOString(), endsAt: later(30) };
      await api.saveCoupon(body, editing ?? undefined);
      setEditing(null);
      setCode("");
      load();
    } catch (reason) {
      setError(messageOf(reason, "Could not save the coupon"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Coupons" error={error}>
      <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">{editing ? "Edit coupon" : "Add coupon"}</h2>
        {editing ? null : (
          <input className={field} required minLength={3} placeholder="Code" value={code} onChange={(event) => setCode(event.target.value)} />
        )}
        <select className={field} value={type} onChange={(event) => setType(event.target.value)}>
          <option value="PERCENTAGE">Percentage</option>
          <option value="FIXED_AMOUNT">Fixed amount</option>
        </select>
        <input className={field} required inputMode="decimal" placeholder="Value" value={value} onChange={(event) => setValue(event.target.value)} />
        <button disabled={busy} className="rounded-xl bg-[#2ec9a8] px-4 py-2 text-sm font-semibold text-white">{busy ? "Saving…" : "Save"}</button>
      </form>
      <ResourceTable
        loading={loading}
        rows={items.map((item) => ({ id: item.id, label: `${item.code} · ${item.type} ${item.value}` }))}
        onEdit={async (id) => {
          const item = await api.coupon(id);
          setEditing(item.id);
          setType(item.type);
          setValue(String(item.value));
        }}
        onDelete={async (id) => {
          await api.deleteCoupon(id);
          load();
        }}
      />
    </Panel>
  );
}

export function AdminPromotions() {
  const [items, setItems] = useState<Promotion[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState("PERCENTAGE");
  const [value, setValue] = useState("10");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.adminPromotions().then(setItems).catch((reason) => setError(messageOf(reason, "Could not load promotions"))).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.savePromotion({ name, type, value: Number(value), startsAt: new Date().toISOString(), endsAt: later(30) });
      setName("");
      load();
    } catch (reason) {
      setError(messageOf(reason, "Could not save the promotion"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Promotions" error={error}>
      <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Add promotion</h2>
        <input className={field} required minLength={2} placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <select className={field} value={type} onChange={(event) => setType(event.target.value)}>
          <option value="PERCENTAGE">Percentage</option>
          <option value="FIXED_AMOUNT">Fixed amount</option>
        </select>
        <input className={field} required inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} />
        <button disabled={busy} className="rounded-xl bg-[#2ec9a8] px-4 py-2 text-sm font-semibold text-white">{busy ? "Saving…" : "Add"}</button>
      </form>
      <ResourceTable
        loading={loading}
        rows={items.map((item) => ({ id: item.id, label: item.name }))}
        onDelete={async (id) => {
          await api.deletePromotion(id);
          load();
        }}
        onEdit={async (id) => {
          const item = items.find((row) => row.id === id);
          if (!item) return;
          await api.savePromotion({ isActive: item.isActive === false }, id);
          load();
        }}
      />
    </Panel>
  );
}

export function AdminCatalogExtras() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [brand, setBrand] = useState("");
  const [size, setSize] = useState("");
  const [fabric, setFabric] = useState("");
  const [composition, setComposition] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    Promise.all([api.catalog(), api.brands(), api.sizes(), api.fabrics()])
      .then(([catalog, brands, sizes, fabrics]) => setCatalog({ ...catalog, brands, sizes, fabrics }))
      .catch((reason) => setError(messageOf(reason, "Could not load catalog")))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {error ? <p className="text-sm text-rose-700 lg:col-span-3">{error}</p> : null}
      <MiniCreate title="Brand" value={brand} setValue={setBrand} onSave={() => api.createBrand({ name: brand }).then(load)} rows={(catalog?.brands ?? []).map((item) => item.name)} loading={loading} />
      <MiniCreate title="Size" value={size} setValue={setSize} onSave={() => api.createSize({ name: size }).then(load)} rows={(catalog?.sizes ?? []).map((item) => item.name)} loading={loading} />
      <form
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          api.createFabric({ name: fabric, composition: composition || null }).then(() => {
            setFabric("");
            setComposition("");
            load();
          }).catch((reason) => setError(messageOf(reason, "Could not add the fabric")));
        }}
      >
        <h2 className="text-sm font-semibold">Fabric</h2>
        <input className={field} required placeholder="Name" value={fabric} onChange={(event) => setFabric(event.target.value)} />
        <input className={field} placeholder="Composition" value={composition} onChange={(event) => setComposition(event.target.value)} />
        <button className="rounded-xl bg-[#2ec9a8] px-4 py-2 text-sm font-semibold text-white">Add</button>
        {loading ? <RowsSkeleton rows={3} /> : <ul className="text-sm text-slate-600">{(catalog?.fabrics ?? []).map((item) => <li key={item.id}>{item.name}</li>)}</ul>}
      </form>
    </div>
  );
}

function MiniCreate({ title, value, setValue, onSave, rows, loading = false }: { title: string; value: string; setValue: (value: string) => void; onSave: () => Promise<unknown>; rows: string[]; loading?: boolean }) {
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        setError("");
        onSave().then(() => setValue("")).catch((reason) => setError(messageOf(reason, "Could not save")));
      }}
    >
      <h2 className="text-sm font-semibold">{title}</h2>
      <input className={field} required placeholder="Name" value={value} onChange={(event) => setValue(event.target.value)} />
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <button className="rounded-xl bg-[#2ec9a8] px-4 py-2 text-sm font-semibold text-white">Add</button>
      {loading ? <RowsSkeleton rows={3} /> : <ul className="text-sm text-slate-600">{rows.map((row) => <li key={row}>{row}</li>)}</ul>}
    </form>
  );
}

export function AdminOutlets() {
  const [items, setItems] = useState<Outlet[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", address: "", city: "", phone: "", hours: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.outlets().then(setItems).catch((reason) => setError(messageOf(reason, "Could not load outlets"))).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api.saveOutlet({ ...form, hours: form.hours || null }, editing ?? undefined);
      setEditing(null);
      setForm({ name: "", address: "", city: "", phone: "", hours: "" });
      load();
    } catch (reason) {
      setError(messageOf(reason, "Could not save the outlet"));
    }
  }

  return (
    <Panel title="Outlets" error={error}>
      <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">{editing ? "Edit outlet" : "Add outlet"}</h2>
        {(["name", "address", "city", "phone", "hours"] as const).map((key) => (
          <input key={key} className={field} required={key !== "hours"} placeholder={key} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
        ))}
        <button className="rounded-xl bg-[#2ec9a8] px-4 py-2 text-sm font-semibold text-white">Save</button>
      </form>
      <ResourceTable
        loading={loading}
        rows={items.map((item) => ({ id: item.id, label: `${item.name} · ${item.city}` }))}
        onEdit={async (id) => {
          const item = await api.outlet(id);
          setEditing(item.id);
          setForm({ name: item.name, address: item.address, city: item.city, phone: item.phone, hours: item.hours ?? "" });
        }}
        onDelete={async (id) => {
          await api.deleteOutlet(id);
          load();
        }}
      />
    </Panel>
  );
}

export function AdminPages() {
  const [items, setItems] = useState<CmsPage[]>([]);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.managePages().then(setItems).catch((reason) => setError(messageOf(reason, "Could not load pages"))).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <Panel title="Pages" error={error}>
      <form
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          api.savePage(slug, { title, body }).then(() => {
            setSlug("");
            setTitle("");
            setBody("");
            load();
          }).catch((reason) => setError(messageOf(reason, "Could not save the page")));
        }}
      >
        <h2 className="text-sm font-semibold">Page</h2>
        <input className={field} required placeholder="slug" value={slug} onChange={(event) => setSlug(event.target.value)} />
        <input className={field} required placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <textarea className={`${field} h-28 py-2`} required placeholder="Body" value={body} onChange={(event) => setBody(event.target.value)} />
        <button className="rounded-xl bg-[#2ec9a8] px-4 py-2 text-sm font-semibold text-white">Save</button>
      </form>
      <ResourceTable
        loading={loading}
        rows={items.map((item) => ({ id: item.slug, label: item.title }))}
        onEdit={(slugKey) => {
          const item = items.find((page) => page.slug === slugKey);
          if (!item) return Promise.resolve();
          setSlug(item.slug);
          setTitle(item.title);
          setBody(item.body ?? "");
          return api.page(slugKey).then((page) => setBody(page.body ?? ""));
        }}
        onDelete={async (slugKey) => {
          await api.deletePage(slugKey);
          load();
        }}
      />
    </Panel>
  );
}

export function AdminDelivery() {
  const [items, setItems] = useState<DeliveryZone[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [fee, setFee] = useState("60");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.zones().then(setItems).catch((reason) => setError(messageOf(reason, "Could not load zones"))).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <Panel title="Delivery" error={error}>
      <form
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          api.saveZone({ name, city: city || null, fee: Number(fee) }, editing ?? undefined).then(() => {
            setEditing(null);
            setName("");
            setCity("");
            load();
          }).catch((reason) => setError(messageOf(reason, "Could not save the zone")));
        }}
      >
        <h2 className="text-sm font-semibold">{editing ? "Edit zone" : "Add zone"}</h2>
        <input className={field} required placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <input className={field} placeholder="City" value={city} onChange={(event) => setCity(event.target.value)} />
        <input className={field} required inputMode="decimal" placeholder="Fee" value={fee} onChange={(event) => setFee(event.target.value)} />
        <button className="rounded-xl bg-[#2ec9a8] px-4 py-2 text-sm font-semibold text-white">Save</button>
      </form>
      <ResourceTable
        loading={loading}
        rows={items.map((item) => ({ id: item.id, label: `${item.name} · ${item.city ?? "All"} · ${item.fee}` }))}
        onEdit={async (id) => {
          const item = await api.zone(id);
          setEditing(item.id);
          setName(item.name);
          setCity(item.city ?? "");
          setFee(String(item.fee));
        }}
        onDelete={async (id) => {
          await api.deleteZone(id);
          load();
        }}
      />
    </Panel>
  );
}

export function AdminNewsletter() {
  const [items, setItems] = useState<Subscriber[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  function load() {
    setLoading(true);
    api.subscribers().then(setItems).catch((reason) => setError(messageOf(reason, "Could not load subscribers"))).finally(() => setLoading(false));
  }
  useEffect(load, []);
  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <ResourceTable
        loading={loading}
        rows={items.map((item) => ({ id: item.id, label: item.email }))}
        onDelete={async (id) => {
          await api.deleteSubscriber(id);
          load();
        }}
      />
    </div>
  );
}

export function AdminSettings() {
  const { user, updateProfile, saveAvatar } = useAuth();
  const { settings, settingsReady } = useStore();
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordNote, setPasswordNote] = useState("");
  const [form, setForm] = useState<Settings>(settings);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => setForm(settings), [settings]);

  if (!settingsReady) return <RowsSkeleton rows={8} />;

  return (
    <div className="grid gap-5">
    <form
      className="max-w-xl space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        setError("");
        setNote("");
        api.updateSettings(form).then(() => setNote("Saved")).catch((reason) => setError(messageOf(reason, "Could not save settings")));
      }}
    >
      <h2 className="text-sm font-semibold">Store settings</h2>
      {(["storeName", "supportEmail", "supportPhone", "address", "facebookUrl", "instagramUrl", "bkashNumber", "nagadNumber", "rocketNumber"] as const).map((key) => (
        <label key={key} className="block text-xs text-slate-500">
          {key === "bkashNumber" ? "bKash Personal account number" : key === "nagadNumber" ? "Nagad account number" : key === "rocketNumber" ? "Rocket account number" : key}
          <input className={`${field} mt-1`} value={form[key] ?? ""} onChange={(event) => setForm({ ...form, [key]: key === "storeName" ? event.target.value : event.target.value || null })} />
        </label>
      ))}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {note ? <p className="text-sm text-emerald-700">{note}</p> : null}
      <button className="rounded-xl bg-[#2ec9a8] px-4 py-2 text-sm font-semibold text-white">Save</button>
    </form>
    <form
      className="max-w-xl space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        setPasswordNote("");
        updateProfile(password)
          .then(() => {
            setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
            setPasswordNote("Password changed");
          })
          .catch((reason) => setPasswordNote(messageOf(reason, "Could not change the password")));
      }}
    >
      <h2 className="text-sm font-semibold">Profile photo</h2>
      {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover bg-slate-200" /> : null}
      {user && !user.avatarUrl ? <span className="grid h-16 w-16 place-items-center rounded-full bg-[#ff9f1a] text-lg font-bold text-slate-900">{user.firstName.slice(0, 1)}</span> : null}
      <label className="block text-xs text-slate-500">
        Photo
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className={`${field} mt-1`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setPasswordNote("");
            saveAvatar(file).then(() => setPasswordNote("Photo saved")).catch((reason) => setPasswordNote(messageOf(reason, "Could not save the photo")));
          }}
        />
      </label>
      <h2 className="text-sm font-semibold">Change password</h2>
      <label className="block text-xs text-slate-500">
        Current password
        <input type="password" required className={`${field} mt-1`} value={password.currentPassword} onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })} />
      </label>
      <label className="block text-xs text-slate-500">
        New password
        <input type="password" required minLength={8} className={`${field} mt-1`} value={password.newPassword} onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} />
      </label>
      <label className="block text-xs text-slate-500">
        Confirm password
        <input type="password" required className={`${field} mt-1`} value={password.confirmPassword} onChange={(event) => setPassword({ ...password, confirmPassword: event.target.value })} />
      </label>
      {passwordNote ? <p className="text-sm text-slate-600">{passwordNote}</p> : null}
      <button className="rounded-xl bg-[#2ec9a8] px-4 py-2 text-sm font-semibold text-white">Change password</button>
    </form>
    </div>
  );
}

export function AdminReturns() {
  const [items, setItems] = useState<StoreReturn[]>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  function load() {
    setLoading(true);
    api.returns().then(setItems).catch((reason) => setError(messageOf(reason, "Could not load returns"))).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <label className="block text-xs text-slate-500">
        Note for the next decision
        <input className={`${field} mt-1`} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      {loading ? <RowsSkeleton rows={3} /> : null}
      {!loading && items.length === 0 && !error ? <p className="text-sm text-slate-500">No return requests yet.</p> : null}
      <div className="space-y-3">
        {!loading && items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{item.order?.orderNumber ?? item.returnNumber} · {titleCaseStatus(item.status)}</p>
                <p className="text-sm text-slate-500">{item.user ? `${item.user.firstName} ${item.user.lastName} · ${item.user.email}` : "Customer"}</p>
                <p className="mt-1 text-sm">{titleCaseStatus(item.reason)}{item.note ? ` — ${item.note}` : ""}</p>
                <ul className="mt-2 text-sm text-slate-600">
                  {(item.items ?? []).map((line) => (
                    <li key={line.id}>{line.orderItem?.productName ?? "Item"} × {line.quantity}</li>
                  ))}
                </ul>
              </div>
              {item.status === "REQUESTED" ? (
                <div className="flex gap-2">
                  <button type="button" className="rounded-xl bg-[#2ec9a8] px-3 py-2 text-sm font-semibold text-white" onClick={() => api.reviewReturn(item.id, { decision: "APPROVED", ...(note ? { adminNote: note } : {}) }).then(load).catch((reason) => setError(messageOf(reason, "Could not approve")))}>Approve</button>
                  <button type="button" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700" onClick={() => api.reviewReturn(item.id, { decision: "REJECTED", ...(note ? { adminNote: note } : {}) }).then(load).catch((reason) => setError(messageOf(reason, "Could not reject")))}>Reject</button>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function AdminPayments() {
  const [items, setItems] = useState<ManualPayment[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  function load() {
    setLoading(true);
    api.manualPayments().then(setItems).catch((err) => setError(messageOf(err, "Could not load payments"))).finally(() => setLoading(false));
  }
  useEffect(load, []);
  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <input className={field} placeholder="Reject reason" value={reason} onChange={(event) => setReason(event.target.value)} />
      <ResourceTable
        loading={loading}
        rows={items.map((item) => ({ id: item.id, label: `${item.order?.orderNumber ?? item.provider} · ${item.transactionId ?? ""} · ${item.amount}` }))}
        onEdit={async (id) => {
          await api.approvePayment(id);
          load();
        }}
        onDelete={async (id) => {
          await api.rejectPayment(id, reason || "Rejected");
          load();
        }}
      />
    </div>
  );
}

export function AdminSizeGuides() {
  const [items, setItems] = useState<SizeGuide[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  function load() {
    setLoading(true);
    api.adminSizeGuides().then(setItems).catch((reason) => setError(messageOf(reason, "Could not load size guides"))).finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    api.adminCategories().then(setCategories).catch(() => setCategories([]));
  }, []);
  return (
    <Panel title="Size guides" error={error}>
      <form
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          api.saveSizeGuide({
            categoryId,
            title,
            columns: ["Size", "Bust (in)", "Waist (in)", "Length (in)"],
            rows: [
              ["XS", "32", "26", "42"],
              ["S", "34", "28", "44"],
              ["M", "36", "30", "46"],
              ["L", "38", "32", "48"],
              ["XL", "40", "34", "50"],
            ],
          }).then(() => {
            setTitle("");
            load();
          }).catch((reason) => setError(messageOf(reason, "Could not save the size guide")));
        }}
      >
        <h2 className="text-sm font-semibold">Size guide</h2>
        <select className={field} required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">Category</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <input className={field} required placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <button className="rounded-xl bg-[#2ec9a8] px-4 py-2 text-sm font-semibold text-white">Add</button>
      </form>
      <ResourceTable
        loading={loading}
        rows={items.map((item) => ({ id: item.id, label: item.title }))}
        onEdit={async (id) => {
          await api.sizeGuide(id);
        }}
        onDelete={async (id) => {
          await api.deleteSizeGuide(id);
          load();
        }}
      />
    </Panel>
  );
}

export function AdminVariants() {
  const [items, setItems] = useState<VariantRow[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [productId, setProductId] = useState("");
  const [sizeId, setSizeId] = useState("");
  const [fabricId, setFabricId] = useState("");
  const [sku, setSku] = useState("");
  const [stock, setStock] = useState("0");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  function load() {
    setLoading(true);
    api.variants({ limit: 50, page: 1 }).then(setItems).catch((reason) => setError(messageOf(reason, "Could not load variants"))).finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    api.catalog().then(setCatalog).catch(() => undefined);
  }, []);
  return (
    <Panel title="Variants" error={error}>
      <form
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          api.saveVariant({ productId, sizeId, fabricId, sku, stock: Number(stock) }).then(() => {
            setSku("");
            load();
          }).catch((reason) => setError(messageOf(reason, "Could not save the variant")));
        }}
      >
        <h2 className="text-sm font-semibold">Variant</h2>
        <input className={field} required placeholder="Product id" value={productId} onChange={(event) => setProductId(event.target.value)} />
        <select className={field} required value={sizeId} onChange={(event) => setSizeId(event.target.value)}>
          <option value="">Size</option>
          {(catalog?.sizes ?? []).map((size) => <option key={size.id} value={size.id}>{size.name}</option>)}
        </select>
        <select className={field} required value={fabricId} onChange={(event) => setFabricId(event.target.value)}>
          <option value="">Fabric</option>
          {(catalog?.fabrics ?? []).map((fabric) => <option key={fabric.id} value={fabric.id}>{fabric.name}</option>)}
        </select>
        <input className={field} required placeholder="SKU" value={sku} onChange={(event) => setSku(event.target.value)} />
        <input className={field} inputMode="numeric" value={stock} onChange={(event) => setStock(event.target.value)} />
        <button className="rounded-xl bg-[#2ec9a8] px-4 py-2 text-sm font-semibold text-white">Add</button>
      </form>
      {note ? <p className="text-sm text-slate-600 lg:col-span-2">{note}</p> : null}
      <ResourceTable
        loading={loading}
        rows={items.map((item) => ({ id: item.id, label: `${item.sku} · stock ${item.stock}${item.isActive ? "" : " · inactive"}` }))}
        onEdit={async (id) => {
          const item = await api.variant(id);
          await api.saveVariant({ isActive: !item.isActive }, id);
          load();
        }}
        onDelete={async (id) => {
          const result = await api.deleteVariant(id);
          setNote(result.message);
          load();
        }}
      />
    </Panel>
  );
}

function ResourceTable({
  rows,
  loading = false,
  onEdit,
  onDelete,
}: {
  rows: { id: string; label: string }[];
  loading?: boolean;
  onEdit?: (id: string) => Promise<unknown> | void;
  onDelete?: (id: string) => Promise<unknown> | void;
}) {
  const [error, setError] = useState("");
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {error ? <p className="px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {loading ? <div className="p-4"><RowsSkeleton rows={5} columns={2} /></div> : rows.length === 0 ? (
        <p className="px-4 py-8 text-sm text-slate-500">Nothing here yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{row.label}</td>
                <td className="px-4 py-3 text-right">
                  {onEdit ? (
                    <button type="button" className="mr-3 text-[#163a8a]" onClick={() => Promise.resolve(onEdit(row.id)).catch((reason) => setError(messageOf(reason, "Could not update")))}>
                      Open
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button
                      type="button"
                      className="text-rose-700"
                      onClick={() => {
                        if (!window.confirm("Delete this?")) return;
                        Promise.resolve(onDelete(row.id)).catch((reason) => setError(messageOf(reason, "Could not delete")));
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
