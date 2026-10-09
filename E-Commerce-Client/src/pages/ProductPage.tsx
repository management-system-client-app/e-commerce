import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, api } from "../api";
import { ProductCarousel } from "../components/ProductCard";
import { DetailSkeleton, ProductGridSkeleton, RowsSkeleton } from "../components/Skeleton";
import { coverImage, money, productFlags } from "../format";
import { useAuth, useCart } from "../state";
import type { ProductCardData, ProductDetail, Review, SizeGuide } from "../types";

const RECENT_PRODUCTS_KEY = "recently_viewed_products";
const GENDER_LABELS: Record<string, string> = {
  MEN: "Male",
  WOMEN: "Female",
  UNISEX: "Unisex",
  KIDS: "Kids",
};
type ProductInfoTab = "description" | "specification" | "return-policy" | "reviews";

const DEFAULT_SARI_SIZE_GUIDE: SizeGuide = {
  id: "default-sari-size-guide",
  title: "Sari / blouse size guide",
  categoryId: "",
  columns: ["Size", "Bust (in)", "Waist (in)", "Length (in)"],
  rows: [
    ["XS", "32", "26", "42"],
    ["S", "34", "28", "44"],
    ["M", "36", "30", "46"],
    ["L", "38", "32", "48"],
    ["XL", "40", "34", "50"],
  ],
};

function recordRecentlyViewed(id: string) {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(RECENT_PRODUCTS_KEY) ?? "[]");
    const ids = Array.isArray(stored) ? stored.filter((value): value is string => typeof value === "string") : [];
    const previous = ids.filter((productId) => productId !== id).slice(0, 5);
    localStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify([id, ...previous]));
    return previous;
  } catch {
    return [];
  }
}

export function ProductPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const { add, busy } = useCart();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [related, setRelated] = useState<ProductCardData[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState(0);
  const [infoTab, setInfoTab] = useState<ProductInfoTab>("specification");
  const [guides, setGuides] = useState<SizeGuide[]>([]);
  const [guideOpen, setGuideOpen] = useState(false);
  const [image, setImage] = useState(0);
  const displayGuides = guides.length > 0 ? guides : [DEFAULT_SARI_SIZE_GUIDE];
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [colorId, setColorId] = useState<string | null>(null);
  const [fabricId, setFabricId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [relatedLoading, setRelatedLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: "", comment: "" });
  const [reviewMessage, setReviewMessage] = useState("");
  const [recentProducts, setRecentProducts] = useState<ProductCardData[]>([]);
  const [recentIndex, setRecentIndex] = useState(0);
  const [recentLoading, setRecentLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setProduct(null);
    setError("");
    setRecentProducts([]);
    setRecentIndex(0);
    api
      .product(id)
      .then((next) => {
        if (!active) return;
        setProduct(next);
        const previousIds = recordRecentlyViewed(id);
        setRecentLoading(previousIds.length > 0);
        Promise.all(previousIds.map((productId) => api.product(productId).catch(() => null)))
          .then((items) => {
            if (active) setRecentProducts(items.filter((item): item is ProductDetail => item !== null));
          })
          .finally(() => {
            if (active) setRecentLoading(false);
          });
        const first = next.variants.find((variant) => variant.isActive !== false) ?? next.variants[0];
        setSizeId(first?.size.id ?? null);
        setColorId(first?.color?.id ?? null);
        setFabricId(first?.fabric.id ?? null);
        setImage(0);
        api.related(id).then((items) => active && setRelated(items)).catch(() => undefined).finally(() => active && setRelatedLoading(false));
        api.reviews(id).then((result) => {
          if (!active) return;
          setReviews(result.items);
          setAverage(result.summary.averageRating);
        }).catch(() => undefined).finally(() => active && setReviewsLoading(false));
        api.sizeGuides(next.category.id).then((items) => active && setGuides(items)).catch(() => undefined);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Product not found");
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    setRelatedLoading(true);
    setReviewsLoading(true);
  }, [id]);

  useEffect(() => {
    if (recentProducts.length < 2) return;
    const timer = window.setInterval(() => {
      setRecentIndex((index) => (index + 1) % recentProducts.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [recentProducts.length]);

  useEffect(() => {
    if (recentProducts.length === 0) {
      setRecentIndex(0);
      return;
    }
    setRecentIndex((current) => current % recentProducts.length);
  }, [recentProducts.length]);

  const variants = useMemo(
    () => (product?.variants ?? []).filter((variant) => variant.isActive !== false),
    [product],
  );
  const sizes = useMemo(() => {
    const map = new Map(variants.map((variant) => [variant.size.id, variant.size]));
    return [...map.values()];
  }, [variants]);
  const colors = useMemo(() => {
    const pool = variants.filter((variant) => !sizeId || variant.size.id === sizeId);
    const map = new Map(pool.flatMap((variant) => (variant.color ? [[variant.color.id, variant.color] as const] : [])));
    return [...map.values()];
  }, [variants, sizeId]);
  const fabrics = useMemo(() => {
    const pool = variants.filter(
      (variant) =>
        (!sizeId || variant.size.id === sizeId) &&
        (!colorId || variant.color?.id === colorId),
    );
    const map = new Map(pool.map((variant) => [variant.fabric.id, variant.fabric]));
    return [...map.values()];
  }, [variants, sizeId, colorId]);
  const selected = variants.find(
    (variant) =>
      variant.size.id === sizeId &&
      (variant.color?.id ?? null) === colorId &&
      variant.fabric.id === (fabricId ?? fabrics[0]?.id),
  );
  const gallery = useMemo(() => {
    if (!product) return [];
    const matched = product.images.filter((item) => !colorId || item.colorId === colorId || !item.colorId);
    return matched.length > 0 ? matched : product.images;
  }, [product, colorId]);

  if (error) return <p className="error">{error}</p>;
  if (!product) return <DetailSkeleton />;

  const flags = productFlags(product);
  const unit = selected?.price != null ? Number(selected.price) : flags.price;
  const available = selected ? Math.max(selected.stock - (selected.reserved ?? 0), 0) : 0;
  const photo = gallery[image] ?? gallery[0];

  async function onAdd() {
    if (!selected) {
      setError("Choose a size");
      return;
    }
    setError("");
    try {
      await add(selected.id, quantity);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add to cart");
    }
  }

  async function toggleWish() {
    if (!user) {
      window.location.assign("/login");
      return;
    }
    try {
      if (saved) {
        await api.removeWishlist(product!.id);
        setSaved(false);
      } else {
        await api.saveWishlist(product!.id);
        setSaved(true);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Wishlist failed");
    }
  }

  async function onReview(event: FormEvent) {
    event.preventDefault();
    setReviewMessage("");
    try {
      const created = await api.createReview({
        productId: product!.id,
        rating: reviewForm.rating,
        title: reviewForm.title || undefined,
        comment: reviewForm.comment,
      });
      setReviews((current) => [created, ...current]);
      setAverage((current) => (current * reviews.length + created.rating) / (reviews.length + 1));
      setReviewForm({ rating: 5, title: "", comment: "" });
      setReviewMessage("Review posted.");
    } catch (reason) {
      setReviewMessage(reason instanceof ApiError ? reason.message : "Could not post review");
    }
  }

  return (
    <div>
      <p className="crumb">
        <Link to="/">Home</Link> / <Link to={`/shop?categoryId=${product.category.id}`}>{product.category.name}</Link> /{" "}
        {product.name}
      </p>
      <div className="pdp">
        <div className="pdp-main">
        <div>
          <div className="gallery-main">
            {photo ? (
              <img
                src={photo.url}
                alt={photo.alt || product.name}
                onMouseMove={(event) => {
                  const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
                  if (!bounds) return;
                  const x = ((event.clientX - bounds.left) / bounds.width) * 100;
                  const y = ((event.clientY - bounds.top) / bounds.height) * 100;
                  event.currentTarget.style.setProperty("--zoom-x", `${x}%`);
                  event.currentTarget.style.setProperty("--zoom-y", `${y}%`);
                }}
              />
            ) : (
              <div className="photo-fallback">Photo</div>
            )}
          </div>
          <div className="thumbs">
            {gallery.map((item, index) => (
              <button key={item.id ?? item.url} type="button" className={index === image ? "on" : ""} onClick={() => setImage(index)}>
                <img src={item.url} alt="" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="label">{product.brand.name}</p>
          <h1>{product.name}</h1>
          <p className="price">
            {money(unit)}
            {flags.compare != null ? <s>{money(flags.compare)}</s> : null}
          </p>
          <div className="flags" style={{ position: "static", flexDirection: "row", marginBottom: 8 }}>
            {flags.isNew ? <span className="flag">New</span> : null}
            {flags.onSale ? <span className="flag">Sale</span> : null}
          </div>
          <p className="option-label">Size</p>
          <div className="sizes">
            {sizes.map((size) => (
              <button
                key={size.id}
                type="button"
                className={sizeId === size.id ? "size-btn on" : "size-btn"}
                onClick={() => setSizeId(size.id)}
              >
                {size.name}
              </button>
            ))}
          </div>
          {colors.length > 0 ? (
            <>
              <p className="option-label">Color</p>
              <div className="swatches">
                {colors.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    className={colorId === color.id ? "swatch on" : "swatch"}
                    style={{ background: color.hexCode }}
                    aria-label={color.name}
                    onClick={() => setColorId(color.id)}
                  />
                ))}
              </div>
            </>
          ) : null}
          <p className="option-label">Fabric</p>
          {fabrics.length > 1 ? (
            <div className="sizes">
              {fabrics.map((fabric) => (
                <button
                  key={fabric.id}
                  type="button"
                  className={fabricId === fabric.id ? "size-btn on" : "size-btn"}
                  onClick={() => setFabricId(fabric.id)}
                >
                  {fabric.name}
                </button>
              ))}
            </div>
          ) : (
            <p>{selected?.fabric.name ?? fabrics[0]?.name ?? "—"}</p>
          )}
          {selected?.fabric.composition ? <p className="note">{selected.fabric.composition}</p> : null}
          <p className="stock">{available > 0 ? `${available} in stock` : "Out of stock"}</p>
          <p className="option-label">Quantity</p>
          <div className="qty">
            <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease">
              −
            </button>
            <span>{quantity}</span>
            <button type="button" onClick={() => setQuantity((value) => Math.min(available || 99, value + 1))} aria-label="Increase">
              +
            </button>
          </div>
          {error ? <p className="error">{error}</p> : null}
          <div className="actions">
            <button className="btn wide" type="button" disabled={busy || available < 1} onClick={onAdd}>
              Add to cart
            </button>
            <button className="btn-line wide" type="button" onClick={toggleWish}>
              {saved ? "Saved" : "Wishlist"}
            </button>
            {displayGuides.length > 0 ? (
              <button className="see-more" type="button" onClick={() => setGuideOpen(true)}>
                Size guide
              </button>
            ) : null}
          </div>
          <div className="prose">{product.description}</div>
          {product.careInstructions ? <p className="note">Care: {product.careInstructions}</p> : null}
        </div>
        <section className="section product-info-section">
          <div className="product-info-tabs" role="tablist" aria-label="Product information">
            {([
              ["description", "Description"],
              ["specification", "Specification"],
              ["return-policy", "Return Policy"],
              ["reviews", `Reviews (${reviews.length})`],
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                id={`product-tab-${tab}`}
                type="button"
                role="tab"
                aria-selected={infoTab === tab}
                aria-controls="product-info-panel"
                className={infoTab === tab ? "active" : ""}
                onClick={() => setInfoTab(tab)}
              >
                {label}
              </button>
            ))}
          </div>
          <div id="product-info-panel" className="product-info-panel" role="tabpanel" aria-labelledby={`product-tab-${infoTab}`}>
            {infoTab === "description" ? (
              <div className="product-description">{product.description || "No description found for this product."}</div>
            ) : null}
            {infoTab === "specification" ? (
              <div className="product-specs" aria-label="Product details">
                <p><span>Brand:</span> {product.brand.name}</p>
                <p><span>Fabric:</span> {selected?.fabric.name ?? "—"}</p>
                <p><span>Gender:</span> {GENDER_LABELS[product.gender] ?? product.gender}</p>
                <p><span>Color:</span> {selected?.color?.name ?? "—"}</p>
                <p><span>Size:</span> {selected?.size.name ?? "—"}</p>
                <p className="product-specs-note">
                  <span>Note:</span> The color is the same as the picture. However, it may slightly differ due to lighting.
                </p>
              </div>
            ) : null}
            {infoTab === "return-policy" ? (
              <div className="product-policy">
                <p>15 Days replacement policy only for SaRa Lifestyle manufacture products.</p>
                <p>Please contact customer support to request a replacement.</p>
              </div>
            ) : null}
            {infoTab === "reviews" ? (
              <div className="product-reviews">
                {average > 0 ? <p className="product-average">Average rating: {average.toFixed(1)} / 5</p> : null}
                {reviewsLoading ? <RowsSkeleton rows={3} /> : null}
                {!reviewsLoading && reviews.length === 0 ? <p className="note">No reviews found for this product.</p> : null}
                {reviews.map((review) => (
                  <article key={review.id} className="product-review">
                    <p className="stars">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>
                    {review.title ? <strong>{review.title}</strong> : null}
                    <p>{review.comment}</p>
                    <p className="note">{review.user.firstName} {review.user.lastName}</p>
                  </article>
                ))}
                {user ? (
                  <form onSubmit={onReview}>
                    <label className="field">
                      <span>Rating</span>
                      <div className="rating-input" role="radiogroup" aria-label="Rating">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            role="radio"
                            aria-checked={reviewForm.rating === rating}
                            aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
                            className={rating <= reviewForm.rating ? "selected" : ""}
                            onClick={() => setReviewForm({ ...reviewForm, rating })}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    </label>
                    <label className="field">
                      <span>Title</span>
                      <input value={reviewForm.title} onChange={(event) => setReviewForm({ ...reviewForm, title: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>Review</span>
                      <textarea required minLength={2} value={reviewForm.comment} onChange={(event) => setReviewForm({ ...reviewForm, comment: event.target.value })} />
                    </label>
                    {reviewMessage ? <p className="note">{reviewMessage}</p> : null}
                    <button className="btn" type="submit">Post review</button>
                  </form>
                ) : (
                  <p className="note"><Link to="/login">Login</Link> to review a product you have bought.</p>
                )}
              </div>
            ) : null}
          </div>
        </section>
        </div>
        <aside className="recent-viewed" aria-label="Delivery benefits and recently viewed products">
          <section className="delivery-benefits" aria-label="Delivery and shopping benefits">
            <ul>
              <li>
                <span aria-hidden="true">🚚</span>
                <p>Free shipping inside dhaka city only for <strong>SaRa Lifestyle</strong> products</p>
              </li>
              <li>
                <span aria-hidden="true">🇧🇩</span>
                <p>Home delivery all over Bangladesh</p>
              </li>
              <li>
                <span aria-hidden="true">💳</span>
                <p>Various payment methods</p>
              </li>
              <li>
                <span aria-hidden="true">📦</span>
                <p><strong>15 Days</strong> replacement policy only for <strong>SaRa Lifestyle</strong> manufacture products</p>
              </li>
              <li>
                <span aria-hidden="true">🎧</span>
                <p>Dedicated Customer Support</p>
              </li>
              <li>
                <span aria-hidden="true">🌐</span>
                <p>Verified and Trusted Sellers</p>
              </li>
            </ul>
          </section>
          <section className="recent-viewed-products" aria-label="Recently viewed products">
            <div className="recent-viewed-heading">
              <h2>Recently Viewed</h2>
            </div>
            {recentLoading ? <ProductGridSkeleton count={1} /> : null}
            {!recentLoading && recentProducts.length > 0 ? (() => {
              return (
                <>
                <div className="recent-viewed-slider">
                  {recentProducts.map((recent, index) => {
                    const active = index === recentIndex;
                    const recentImage = coverImage(recent);
                    return (
                      <Link
                        key={recent.id}
                        className={`recent-viewed-card${active ? " is-active" : ""}`}
                        to={`/product/${recent.id}`}
                        aria-hidden={!active}
                        inert={!active}
                      >
                        <div className="recent-viewed-photo">
                          {recentImage ? <img src={recentImage} alt={recent.name} /> : <div className="photo-fallback" />}
                          {productFlags(recent).isNew ? <span className="flag">New</span> : null}
                        </div>
                        <strong>{recent.name}</strong>
                        <span className="price">{money(recent.basePrice)}</span>
                      </Link>
                    );
                  })}
                </div>
                {recentProducts.length > 1 ? (
                  <div className="recent-viewed-dots" aria-label={`Product ${recentIndex + 1} of ${recentProducts.length}`}>
                    {recentProducts.map((item, index) => (
                      <button key={item.id} type="button" className={index === recentIndex ? "on" : ""} aria-label={`Show product ${index + 1}`} onClick={() => setRecentIndex(index)} />
                    ))}
                  </div>
                ) : null}
                </>
              );
            })() : null}
          </section>
        </aside>
      </div>

      {relatedLoading ? <ProductGridSkeleton count={4} /> : null}
      {!relatedLoading && related.length > 0 ? (
        <section className="section">
          <div className="section-head">
            <h2>Related</h2>
          </div>
          <ProductCarousel products={related} />
        </section>
      ) : null}

      {guideOpen ? (
        <div className="modal" role="dialog" aria-label="Size guide">
          <div className="modal-card">
            <header>
              Size guide
              <button type="button" onClick={() => setGuideOpen(false)}>
                Close
              </button>
            </header>
            <div style={{ padding: 16 }}>
              {displayGuides.map((guide) => (
                <div key={guide.id}>
                  <h2 className="label" style={{ marginBottom: 8 }}>
                    {guide.title}
                  </h2>
                  <table>
                    <thead>
                      <tr>
                        {guide.columns.map((column) => (
                          <th key={column}>{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {guide.rows.map((row, index) => (
                        <tr key={index}>
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
