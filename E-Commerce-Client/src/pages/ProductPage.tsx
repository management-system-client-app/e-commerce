import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, api } from "../api";
import { ProductGrid } from "../components/ProductCard";
import { money, productFlags } from "../format";
import { useAuth, useCart } from "../state";
import type { ProductCardData, ProductDetail, Review, SizeGuide } from "../types";

export function ProductPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const { add, busy } = useCart();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [related, setRelated] = useState<ProductCardData[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState(0);
  const [guides, setGuides] = useState<SizeGuide[]>([]);
  const [guideOpen, setGuideOpen] = useState(false);
  const [image, setImage] = useState(0);
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [colorId, setColorId] = useState<string | null>(null);
  const [fabricId, setFabricId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: "", comment: "" });
  const [reviewMessage, setReviewMessage] = useState("");

  useEffect(() => {
    let active = true;
    setProduct(null);
    setError("");
    api
      .product(id)
      .then((next) => {
        if (!active) return;
        setProduct(next);
        const first = next.variants.find((variant) => variant.isActive !== false) ?? next.variants[0];
        setSizeId(first?.size.id ?? null);
        setColorId(first?.color?.id ?? null);
        setFabricId(first?.fabric.id ?? null);
        setImage(0);
        api.related(id).then((items) => active && setRelated(items)).catch(() => undefined);
        api.reviews(id).then((result) => {
          if (!active) return;
          setReviews(result.items);
          setAverage(result.summary.averageRating);
        }).catch(() => undefined);
        api.sizeGuides(next.category.id).then((items) => active && setGuides(items)).catch(() => undefined);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Product not found");
      });
    return () => {
      active = false;
    };
  }, [id]);

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
  if (!product) return <p className="note">Loading…</p>;

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
        <div>
          <div className="gallery-main">
            {photo ? <img src={photo.url} alt={photo.alt || product.name} /> : <div className="photo-fallback">Photo</div>}
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
            {guides.length > 0 ? (
              <button className="see-more" type="button" onClick={() => setGuideOpen(true)}>
                Size guide
              </button>
            ) : null}
          </div>
          <div className="prose">{product.description}</div>
          {product.careInstructions ? <p className="note">Care: {product.careInstructions}</p> : null}
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Reviews {average ? `· ${average}` : ""}</h2>
        </div>
        <div className="reviews">
          {reviews.length === 0 ? <p className="note">No reviews yet.</p> : null}
          {reviews.map((review) => (
            <article key={review.id} className="review">
              <p className="stars">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>
              {review.title ? <strong>{review.title}</strong> : null}
              <p>{review.comment}</p>
              <p className="note">
                {review.user.firstName} {review.user.lastName}
              </p>
            </article>
          ))}
          {user ? (
            <form onSubmit={onReview}>
              <label className="field">
                <span>Rating</span>
                <select
                  value={reviewForm.rating}
                  onChange={(event) => setReviewForm({ ...reviewForm, rating: Number(event.target.value) })}
                >
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <option key={rating} value={rating}>
                      {rating}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Title</span>
                <input value={reviewForm.title} onChange={(event) => setReviewForm({ ...reviewForm, title: event.target.value })} />
              </label>
              <label className="field">
                <span>Review</span>
                <textarea
                  required
                  minLength={2}
                  value={reviewForm.comment}
                  onChange={(event) => setReviewForm({ ...reviewForm, comment: event.target.value })}
                />
              </label>
              {reviewMessage ? <p className="note">{reviewMessage}</p> : null}
              <button className="btn" type="submit">
                Post review
              </button>
            </form>
          ) : (
            <p className="note">
              <Link to="/login">Login</Link> to review a product you have bought.
            </p>
          )}
        </div>
      </section>

      {related.length > 0 ? (
        <section className="section">
          <div className="section-head">
            <h2>Related</h2>
          </div>
          <ProductGrid products={related} />
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
              {guides.map((guide) => (
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
