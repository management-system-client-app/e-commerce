import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, hydrateImages } from "../api";
import { ProductGrid } from "../components/ProductCard";
import { useStore } from "../state";
import type { Color, PageMeta, ProductCardData } from "../types";

const sorts = [
  { id: "latest", label: "Latest" },
  { id: "price_desc", label: "Price high to low" },
  { id: "price_asc", label: "Price low to high" },
  { id: "name_asc", label: "A–Z" },
];

const genders = [
  { id: "WOMEN", label: "Women" },
  { id: "MEN", label: "Men" },
  { id: "KIDS", label: "Kids" },
  { id: "UNISEX", label: "Unisex" },
];

export function ShopPage() {
  const { catalog } = useStore();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<ProductCardData[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [colors, setColors] = useState<Color[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [minPrice, setMinPrice] = useState(params.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(params.get("maxPrice") ?? "");

  const query = useMemo(
    () => ({
      page: params.get("page") ?? "1",
      limit: "20",
      status: "ACTIVE",
      sort: params.get("sort") ?? "latest",
      search: params.get("search") ?? undefined,
      categoryId: params.get("categoryId") ?? undefined,
      brandId: params.get("brandId") ?? undefined,
      gender: params.get("gender") ?? undefined,
      sizeId: params.get("sizeId") ?? undefined,
      colorId: params.get("colorId") ?? undefined,
      fabricId: params.get("fabricId") ?? undefined,
      minPrice: params.get("minPrice") ?? undefined,
      maxPrice: params.get("maxPrice") ?? undefined,
      inStock: params.get("inStock") === "true" ? "true" : undefined,
    }),
    [params],
  );

  useEffect(() => {
    api.colors().then(setColors).catch(() => setColors([]));
  }, []);

  useEffect(() => {
    setMinPrice(params.get("minPrice") ?? "");
    setMaxPrice(params.get("maxPrice") ?? "");
  }, [params]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api
      .products(query)
      .then(async (result) => {
        const withImages = await hydrateImages(result.items);
        if (!active) return;
        setItems(withImages);
        setMeta(result.meta);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setItems([]);
        setError(reason instanceof Error ? reason.message : "Could not load products");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query]);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    setParams(next);
  }

  function applyPrice(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(params);
    if (minPrice) next.set("minPrice", minPrice);
    else next.delete("minPrice");
    if (maxPrice) next.set("maxPrice", maxPrice);
    else next.delete("maxPrice");
    next.delete("page");
    setParams(next);
    setSheet(false);
  }

  const category = catalog.categories.find((item) => item.id === params.get("categoryId"));
  const gender = genders.find((item) => item.id === params.get("gender"));
  const crumb = category?.name ?? gender?.label ?? (params.get("search") ? `Search: ${params.get("search")}` : "Shop");

  const filterProps = {
    catalog,
    colors,
    params,
    minPrice,
    maxPrice,
    setMinPrice,
    setMaxPrice,
    setParam,
    applyPrice,
    clear: () => {
      const next = new URLSearchParams();
      const search = params.get("search");
      if (search) next.set("search", search);
      setParams(next);
      setSheet(false);
    },
  };

  return (
    <div>
      <p className="crumb">
        <Link to="/">Home</Link> / {crumb}
      </p>
      <div className="shop">
        <aside className="filters">
          <Filters {...filterProps} />
        </aside>
        <div>
          <div className="shop-bar">
            <button type="button" className="btn-line filter-toggle" onClick={() => setSheet(true)}>
              Filter
            </button>
            <span className="note">{meta ? `${meta.total} products` : ""}</span>
            <select
              className="sort"
              aria-label="Sort"
              value={params.get("sort") ?? "latest"}
              onChange={(event) => setParam("sort", event.target.value)}
            >
              {sorts.map((sort) => (
                <option key={sort.id} value={sort.id}>
                  {sort.label}
                </option>
              ))}
            </select>
          </div>
          {error ? <p className="error">{error}</p> : null}
          {!loading && items.length === 0 ? <p className="empty">Sorry! No result.</p> : null}
          <ProductGrid products={items} />
          {meta && meta.totalPages > 1 ? (
            <div className="pager">
              {Array.from({ length: meta.totalPages }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  className={page === meta.page ? "on" : ""}
                  onClick={() => setParam("page", String(page))}
                >
                  {page}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {sheet ? (
        <>
          <button className="sheet-back" aria-label="Close filters" onClick={() => setSheet(false)} />
          <div className="sheet filters-sheet" role="dialog" aria-label="Filters">
            <header>
              Filter
              <button type="button" onClick={() => setSheet(false)}>
                Close
              </button>
            </header>
            <div className="sheet-body">
              <Filters {...filterProps} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Filters({
  catalog,
  colors,
  params,
  minPrice,
  maxPrice,
  setMinPrice,
  setMaxPrice,
  setParam,
  applyPrice,
  clear,
}: {
  catalog: ReturnType<typeof useStore>["catalog"];
  colors: Color[];
  params: URLSearchParams;
  minPrice: string;
  maxPrice: string;
  setMinPrice: (value: string) => void;
  setMaxPrice: (value: string) => void;
  setParam: (key: string, value: string | null) => void;
  applyPrice: (event: FormEvent) => void;
  clear: () => void;
}) {
  const selected = (key: string) => params.get(key);

  return (
    <div>
      <button type="button" className="see-more" onClick={clear}>
        Clear
      </button>
      <FilterList
        title="Category"
        options={catalog.categories.map((item) => ({ id: item.id, label: item.name }))}
        selected={selected("categoryId")}
        onPick={(id) => setParam("categoryId", id)}
      />
      <FilterList
        title="Brand"
        options={catalog.brands.map((item) => ({ id: item.id, label: item.name }))}
        selected={selected("brandId")}
        onPick={(id) => setParam("brandId", id)}
      />
      <FilterList
        title="Gender"
        options={genders.map((item) => ({ id: item.id, label: item.label }))}
        selected={selected("gender")}
        onPick={(id) => setParam("gender", id)}
      />
      <div className="filter-block">
        <h3>Size</h3>
        <div className="sizes">
          {catalog.sizes.map((size) => (
            <button
              key={size.id}
              type="button"
              className={selected("sizeId") === size.id ? "size-btn on" : "size-btn"}
              onClick={() => setParam("sizeId", selected("sizeId") === size.id ? null : size.id)}
            >
              {size.name}
            </button>
          ))}
        </div>
      </div>
      <div className="filter-block">
        <h3>Color</h3>
        <div className="swatches">
          {colors.map((color) => (
            <button
              key={color.id}
              type="button"
              className={selected("colorId") === color.id ? "swatch on" : "swatch"}
              style={{ background: color.hexCode }}
              aria-label={color.name}
              onClick={() => setParam("colorId", selected("colorId") === color.id ? null : color.id)}
            />
          ))}
        </div>
      </div>
      <FilterList
        title="Fabric"
        options={catalog.fabrics.map((item) => ({ id: item.id, label: item.name }))}
        selected={selected("fabricId")}
        onPick={(id) => setParam("fabricId", id)}
      />
      <form className="filter-block" onSubmit={applyPrice}>
        <h3>Price</h3>
        <div className="price-row">
          <input value={minPrice} inputMode="decimal" placeholder="Min" aria-label="Minimum price" onChange={(event) => setMinPrice(event.target.value)} />
          <input value={maxPrice} inputMode="decimal" placeholder="Max" aria-label="Maximum price" onChange={(event) => setMaxPrice(event.target.value)} />
        </div>
        <button className="btn" type="submit" style={{ marginTop: 8 }}>
          Apply
        </button>
      </form>
      <div className="filter-block">
        <label className="check">
          <input
            type="checkbox"
            checked={params.get("inStock") === "true"}
            onChange={(event) => setParam("inStock", event.target.checked ? "true" : null)}
          />
          In stock
        </label>
      </div>
    </div>
  );
}

function FilterList({
  title,
  options,
  selected,
  onPick,
}: {
  title: string;
  options: { id: string; label: string }[];
  selected: string | null;
  onPick: (id: string | null) => void;
}) {
  return (
    <div className="filter-block">
      <h3>{title}</h3>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={selected === option.id ? "choice on" : "choice"}
          onClick={() => onPick(selected === option.id ? null : option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
