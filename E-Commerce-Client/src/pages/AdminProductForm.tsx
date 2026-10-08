import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, api } from "../api";
import { useStore } from "../state";

type SizeRow = { sizeId: string; fabricId: string; stock: string };

const fieldClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#2ec9a8]";

function messageOf(reason: unknown, fallback: string) {
  if (!(reason instanceof ApiError)) return fallback;
  const detail = reason.errors?.[0]?.message;
  return detail ? `${reason.message}. ${detail}` : reason.message;
}

export function AdminProductForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { catalog } = useStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [gender, setGender] = useState("WOMEN");
  const [basePrice, setBasePrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [brandId, setBrandId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [rows, setRows] = useState<SizeRow[]>([{ sizeId: "", fabricId: "", stock: "0" }]);
  const [images, setImages] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(!editing);

  useEffect(() => {
    if (!id) return;
    api
      .product(id)
      .then((product) => {
        setName(product.name);
        setDescription(product.description);
        setStatus(product.status);
        setGender(product.gender);
        setBasePrice(String(product.basePrice));
        setCompareAtPrice(product.compareAtPrice == null ? "" : String(product.compareAtPrice));
        setBrandId(product.brand.id);
        setCategoryId(product.category.id);
        setReady(true);
      })
      .catch((reason) => {
        setError(messageOf(reason, "Could not load the product"));
        setReady(true);
      });
  }, [id]);

  function updateRow(index: number, patch: Partial<SizeRow>) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const price = Number(basePrice);
    const compare = compareAtPrice.trim() === "" ? undefined : Number(compareAtPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setError("Price must be greater than 0");
      return;
    }
    if (compare != null && (!Number.isFinite(compare) || compare <= price)) {
      setError("Compare price must be greater than the price");
      return;
    }

    setBusy(true);
    try {
      if (editing && id) {
        await api.updateProduct(id, {
          name: name.trim(),
          description: description.trim(),
          status,
          gender,
          basePrice: price,
          compareAtPrice: compare ?? null,
          brandId,
          categoryId,
        });
        navigate("/admin/products");
        return;
      }

      const sizes = rows
        .filter((row) => row.sizeId && row.fabricId)
        .map((row) => ({
          sizeId: row.sizeId,
          fabricId: row.fabricId,
          stock: Number(row.stock) || 0,
        }));
      if (sizes.length === 0) {
        setError("Add at least one size and fabric");
        setBusy(false);
        return;
      }

      await api.createProduct(
        {
          name: name.trim(),
          description: description.trim(),
          status,
          gender,
          basePrice: price,
          ...(compare != null ? { compareAtPrice: compare } : {}),
          brandId,
          categoryId,
          sizes,
        },
        images,
      );
      navigate("/admin/products");
    } catch (reason) {
      setError(messageOf(reason, "Could not save the product"));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{editing ? "Edit product" : "Add product"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {editing ? "Update the product details." : "Active products show on the shop."}
          </p>
        </div>
        <Link to="/admin/products" className="text-sm text-[#163a8a]">
          Back
        </Link>
      </div>
      {error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="text-slate-500">Name</span>
          <input className={fieldClass} required minLength={2} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="text-slate-500">Description</span>
          <textarea
            className={`${fieldClass} h-28 py-2`}
            required
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-slate-500">Price</span>
          <input className={fieldClass} required inputMode="decimal" value={basePrice} onChange={(event) => setBasePrice(event.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-slate-500">Compare price</span>
          <input className={fieldClass} inputMode="decimal" value={compareAtPrice} onChange={(event) => setCompareAtPrice(event.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-slate-500">Category</span>
          <select className={fieldClass} required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Choose</option>
            {catalog.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-slate-500">Brand</span>
          <select className={fieldClass} required value={brandId} onChange={(event) => setBrandId(event.target.value)}>
            <option value="">Choose</option>
            {catalog.brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-slate-500">Gender</span>
          <select className={fieldClass} value={gender} onChange={(event) => setGender(event.target.value)}>
            <option value="WOMEN">Women</option>
            <option value="MEN">Men</option>
            <option value="KIDS">Kids</option>
            <option value="UNISEX">Unisex</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-slate-500">Status</span>
          <select className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
      </section>

      {editing ? null : (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Size and stock</h2>
            <button
              type="button"
              className="text-sm text-[#163a8a]"
              onClick={() => setRows((current) => [...current, { sizeId: "", fabricId: "", stock: "0" }])}
            >
              Add row
            </button>
          </div>
          {rows.map((row, index) => (
            <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_120px]">
              <select className={fieldClass} required value={row.sizeId} onChange={(event) => updateRow(index, { sizeId: event.target.value })}>
                <option value="">Size</option>
                {catalog.sizes.map((size) => (
                  <option key={size.id} value={size.id}>
                    {size.name}
                  </option>
                ))}
              </select>
              <select className={fieldClass} required value={row.fabricId} onChange={(event) => updateRow(index, { fabricId: event.target.value })}>
                <option value="">Fabric</option>
                {catalog.fabrics.map((fabric) => (
                  <option key={fabric.id} value={fabric.id}>
                    {fabric.name}
                  </option>
                ))}
              </select>
              <input
                className={fieldClass}
                inputMode="numeric"
                aria-label="Stock"
                value={row.stock}
                onChange={(event) => updateRow(index, { stock: event.target.value })}
              />
            </div>
          ))}
          <label className="grid gap-1.5 text-sm">
            <span className="text-slate-500">Photos</span>
            <input
              className="text-sm"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => setImages([...(event.target.files ?? [])].slice(0, 5))}
            />
          </label>
        </section>
      )}

      <button
        type="submit"
        disabled={busy}
        className="h-11 rounded-xl bg-[#2ec9a8] px-5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Saving…" : editing ? "Update product" : "Add product"}
      </button>
    </form>
  );
}
