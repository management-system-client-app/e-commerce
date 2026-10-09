import { FormEvent, useEffect, useState } from "react";
import { ApiError, api } from "../api";
import { RowsSkeleton } from "../components/Skeleton";
import type { AdminHomeBlock, Category, ProductCardData } from "../types";

const fieldClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#2ec9a8]";

const KINDS = [
  { id: "BANNER", label: "Slider banner" },
  { id: "CAMPAIGN", label: "Offer banner" },
  { id: "NEW_ARRIVAL", label: "New arrivals" },
  { id: "TRENDING", label: "Trending Now products" },
] as const;

function messageOf(reason: unknown, fallback: string) {
  if (!(reason instanceof ApiError)) return fallback;
  const detail = reason.errors?.[0]?.message;
  return detail ? `${reason.message}. ${detail}` : reason.message;
}

function parentName(categories: Category[], parentId: string | null) {
  if (!parentId) return "—";
  return categories.find((category) => category.id === parentId)?.name ?? "—";
}

function hasAvailableStock(product: ProductCardData) {
  return product.variants?.some((variant) => variant.stock - (variant.reserved ?? 0) > 0) ?? false;
}

function isVideoUrl(value: string | null | undefined) {
  if (!value) return false;
  return /(\.(mp4|webm|mov|m4v|ogv|avi))(\?.*)?$/i.test(value) || /(?:^|\/)(video|mp4|webm|quicktime)/i.test(value);
}

export function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);

  function load() {
    setLoading(true);
    api
      .adminCategories()
      .then(setCategories)
      .catch((reason) => setError(messageOf(reason, "Could not load categories")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function reset() {
    setEditing(null);
    setName("");
    setDescription("");
    setParentId("");
    setSortOrder("0");
    setIsActive(true);
    setImage(null);
    setFormKey((key) => key + 1);
  }

  function startEdit(category: Category) {
    setEditing(category.id);
    setName(category.name);
    setDescription(category.description ?? "");
    setParentId(category.parentId ?? "");
    setSortOrder(String(category.sortOrder ?? 0));
    setIsActive(category.isActive !== false);
    setImage(null);
    setError("");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.saveCategory(
        {
          name: name.trim(),
          description: description.trim() || null,
          parentId: parentId || null,
          sortOrder: Number(sortOrder) || 0,
          isActive,
        },
        image,
        editing ?? undefined,
      );
      reset();
      load();
    } catch (reason) {
      setError(messageOf(reason, "Could not save the category"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(category: Category) {
    if (!window.confirm(`Delete ${category.name}?`)) return;
    setError("");
    try {
      await api.deleteCategory(category.id);
      if (editing === category.id) reset();
      load();
    } catch (reason) {
      setError(messageOf(reason, "Could not delete the category"));
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <form key={formKey} onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">{editing ? "Edit category" : "Add category"}</h2>
        <label className="block text-xs text-slate-500">
          Name
          <input className={`${fieldClass} mt-1`} required minLength={2} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="block text-xs text-slate-500">
          Parent
          <select className={`${fieldClass} mt-1`} value={parentId} onChange={(event) => setParentId(event.target.value)}>
            <option value="">None</option>
            {categories
              .filter((category) => category.id !== editing)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.isActive === false ? " (hidden)" : ""}
                </option>
              ))}
          </select>
        </label>
        <label className="block text-xs text-slate-500">
          Description
          <textarea className={`${fieldClass} mt-1 h-20 py-2`} value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label className="block text-xs text-slate-500">
          Sort
          <input className={`${fieldClass} mt-1`} inputMode="numeric" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
        </label>
        <label className="block text-xs text-slate-500">
          Image
          <input className="mt-1 block w-full text-sm" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          Active
        </label>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="rounded-xl bg-[#2ec9a8] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Saving…" : editing ? "Update" : "Add"}
          </button>
          {editing ? (
            <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm" onClick={reset}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Parent</th>
              <th className="px-4 py-3 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={3} className="p-4"><RowsSkeleton rows={5} columns={3} /></td></tr> : categories.map((category) => (
              <tr key={category.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {category.imageUrl ? (
                      <img src={category.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-xs text-slate-400">
                        {category.name.slice(0, 1)}
                      </span>
                    )}
                    <span>
                      <span className="block font-medium">{category.name}</span>
                      <span className="text-xs text-slate-500">{category.isActive === false ? "Hidden" : "Active"}</span>
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{parentName(categories, category.parentId)}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" className="mr-3 font-medium text-[#163a8a]" onClick={() => startEdit(category)}>
                    Edit
                  </button>
                  <button type="button" className="text-rose-700" onClick={() => remove(category)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && categories.length === 0 && !error ? <p className="px-4 py-8 text-sm text-slate-500">No categories yet.</p> : null}
      </section>
    </div>
  );
}

export function AdminBanners() {
  const [blocks, setBlocks] = useState<AdminHomeBlock[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("BANNER");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [image, setImage] = useState<File | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState<ProductCardData[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<ProductCardData[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);

  function load() {
    setLoading(true);
    api.homeBlocks().then(setBlocks).catch((reason) => setError(messageOf(reason, "Could not load banners"))).finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    api.adminCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (kind !== "TRENDING") return;
    let active = true;
    api.products({
      status: "ACTIVE",
      inStock: true,
      search: productSearch.trim() || undefined,
      limit: 100,
      page: 1,
    })
      .then(({ items }) => {
        if (active) setProductOptions(items.filter(hasAvailableStock));
      })
      .catch((reason) => {
        if (active) setError(messageOf(reason, "Could not load products"));
      });
    return () => {
      active = false;
    };
  }, [kind, productSearch]);

  function reset() {
    setEditing(null);
    setKind("BANNER");
    setTitle("");
    setSubtitle("");
    setLinkUrl("");
    setCategoryId("");
    setSortOrder("0");
    setIsActive(true);
    setImage(null);
    setCurrentImage(null);
    setProductSearch("");
    setSelectedProducts([]);
    setFormKey((key) => key + 1);
  }

  function startEdit(block: AdminHomeBlock) {
    setEditing(block.id);
    setKind(block.kind);
    setTitle(block.title);
    setSubtitle(block.subtitle ?? "");
    setLinkUrl(block.linkUrl ?? "");
    setCategoryId(block.categoryId ?? "");
    setSortOrder(String(block.sortOrder));
    setIsActive(block.isActive);
    setImage(null);
    setCurrentImage(block.imageUrl);
    setProductSearch("");
    setSelectedProducts(block.products ?? []);
    setError("");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if ((kind === "BANNER" || kind === "CAMPAIGN") && !image && !currentImage) {
      setError("Add an image for this banner");
      return;
    }
    setBusy(true);
    try {
      await api.saveHomeBlock(
        {
          kind,
          title: title.trim(),
          subtitle: subtitle.trim() || null,
          linkUrl: linkUrl.trim() || null,
          categoryId: categoryId || null,
          productIds: kind === "TRENDING" ? selectedProducts.map((product) => product.id) : [],
          sortOrder: Number(sortOrder) || 0,
          isActive,
        },
        image,
        editing ?? undefined,
      );
      reset();
      load();
    } catch (reason) {
      setError(messageOf(reason, "Could not save the banner"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(block: AdminHomeBlock) {
    if (!window.confirm(`Delete ${block.title}?`)) return;
    setError("");
    try {
      await api.deleteHomeBlock(block.id);
      if (editing === block.id) reset();
      load();
    } catch (reason) {
      setError(messageOf(reason, "Could not delete the banner"));
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <form key={formKey} onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">{editing ? "Edit banner" : "Add banner"}</h2>
        <label className="block text-xs text-slate-500">
          Type
          <select className={`${fieldClass} mt-1`} value={kind} onChange={(event) => setKind(event.target.value as (typeof KINDS)[number]["id"])}>
            {KINDS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {kind === "CAMPAIGN" ? (
          <p className="text-xs leading-relaxed text-slate-500">
            The first four active offer banners by Sort order appear in the homepage category collage as Man, Woman, Child, and Accessories. Edit each offer banner here to replace its image or video.
          </p>
        ) : null}
        {kind === "TRENDING" ? (
          <div className="space-y-2 rounded-xl bg-slate-50 p-3">
            <p className="text-xs leading-relaxed text-slate-500">Choose up to 24 active products with available stock. They will appear in Trending Now in the order selected.</p>
            <input
              className={fieldClass}
              placeholder="Search products"
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
            />
            {selectedProducts.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-600">Selected ({selectedProducts.length}/24)</p>
                {selectedProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">{product.name}</span>
                    <button
                      type="button"
                      className="shrink-0 text-rose-700"
                      onClick={() => setSelectedProducts((selected) => selected.filter((item) => item.id !== product.id))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="max-h-44 space-y-1 overflow-y-auto">
              {productOptions.map((product) => {
                const selected = selectedProducts.some((item) => item.id === product.id);
                return (
                  <label key={product.id} className="flex cursor-pointer items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={!selected && selectedProducts.length >= 24}
                      onChange={(event) =>
                        setSelectedProducts((current) =>
                          event.target.checked
                            ? [...current, product]
                            : current.filter((item) => item.id !== product.id),
                        )
                      }
                    />
                    <span className="truncate">{product.name}</span>
                  </label>
                );
              })}
              {productOptions.length === 0 ? <p className="text-xs text-slate-500">No available products found.</p> : null}
            </div>
          </div>
        ) : null}
        <label className="block text-xs text-slate-500">
          Title
          <input className={`${fieldClass} mt-1`} required minLength={2} value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="block text-xs text-slate-500">
          Subtitle
          <input className={`${fieldClass} mt-1`} value={subtitle} onChange={(event) => setSubtitle(event.target.value)} />
        </label>
        <label className="block text-xs text-slate-500">
          Link
          <input className={`${fieldClass} mt-1`} placeholder="/shop" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} />
        </label>
        <label className="block text-xs text-slate-500">
          Category
          <select className={`${fieldClass} mt-1`} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">None</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-500">
          Sort
          <input className={`${fieldClass} mt-1`} inputMode="numeric" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
        </label>
        {kind !== "TRENDING" ? (
          <label className="block text-xs text-slate-500">
            Image or video
            <input className="mt-1 block w-full text-sm" type="file" accept="image/*,video/*" onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
          </label>
        ) : null}
        {currentImage ? (
          isVideoUrl(currentImage) ? (
            <video src={currentImage} controls className="h-20 w-full rounded-lg object-cover" />
          ) : (
            <img src={currentImage} alt="" className="h-20 w-full rounded-lg object-cover" />
          )
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          Active
        </label>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="rounded-xl bg-[#2ec9a8] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Saving…" : editing ? "Update" : "Add"}
          </button>
          {editing ? (
            <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm" onClick={reset}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Banner</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="p-4"><RowsSkeleton rows={5} columns={5} /></td></tr> : blocks.map((block) => (
              <tr key={block.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {block.imageUrl ? (
                      isVideoUrl(block.imageUrl) ? (
                        <video src={block.imageUrl} controls className="h-12 w-20 rounded-lg object-cover" />
                      ) : (
                        <img src={block.imageUrl} alt="" className="h-12 w-20 rounded-lg object-cover" />
                      )
                    ) : (
                      <span className="grid h-12 w-20 place-items-center rounded-lg bg-slate-100 text-xs text-slate-400">None</span>
                    )}
                    <span>
                      <span className="block font-medium">{block.title}</span>
                      <span className="text-xs text-slate-500">
                        {block.isActive ? "Active" : "Hidden"}
                        {block.kind === "TRENDING" ? ` · ${block.productIds.length} selected` : ""}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{KINDS.find((item) => item.id === block.kind)?.label ?? block.kind}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" className="mr-3 font-medium text-[#163a8a]" onClick={() => startEdit(block)}>
                    Edit
                  </button>
                  <button type="button" className="text-rose-700" onClick={() => remove(block)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && blocks.length === 0 && !error ? <p className="px-4 py-8 text-sm text-slate-500">No banners yet. Add a slider banner to show it on the home page.</p> : null}
      </section>
    </div>
  );
}
