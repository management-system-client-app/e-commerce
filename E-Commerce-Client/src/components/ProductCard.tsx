import { Link } from "react-router-dom";
import { coverImage, money, productFlags } from "../format";
import type { ProductCardData } from "../types";

export function ProductCard({
  product,
  showAvailableStock = false,
}: {
  product: ProductCardData;
  showAvailableStock?: boolean;
}) {
  const image = coverImage(product);
  const flags = productFlags(product);
  const discount = flags.compare != null ? Math.round(((flags.compare - flags.price) / flags.compare) * 100) : null;
  const availableStock =
    product.variants?.reduce((total, variant) => total + Math.max(variant.stock - (variant.reserved ?? 0), 0), 0) ?? 0;
  return (
    <article className="card">
      <Link to={`/product/${product.id}`}>
        <div className="card-photo">
          {image ? <img src={image} alt={product.name} /> : <div className="photo-fallback" />}
          {flags.isNew || flags.onSale ? (
            <div className="flags">
              {flags.isNew ? <span className="flag">New</span> : null}
              {flags.onSale ? <span className="flag sale-flag">{discount ? `-${discount}%` : "Sale"}</span> : null}
            </div>
          ) : null}
        </div>
        <div className="card-copy">
          {product.brand?.name ? <span className="card-brand">{product.brand.name}</span> : null}
          <h3>{product.name}</h3>
        <p className="price">
          {money(flags.price)}
          {flags.compare != null ? <s>{money(flags.compare)}</s> : null}
        </p>
        {showAvailableStock ? <p className="stock-count">Available: {availableStock}</p> : null}
        </div>
      </Link>
    </article>
  );
}

export function ProductCarousel({
  products,
  showAvailableStock = false,
}: {
  products: ProductCardData[];
  showAvailableStock?: boolean;
}) {
  return (
    <div className="product-carousel">
      <div className="product-row">
        {products.map((product) => <ProductCard key={product.id} product={product} showAvailableStock={showAvailableStock} />)}
      </div>
    </div>
  );
}

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
