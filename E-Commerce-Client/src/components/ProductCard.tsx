import { Link } from "react-router-dom";
import { coverImage, money, productFlags } from "../format";
import type { ProductCardData } from "../types";

export function ProductCard({ product }: { product: ProductCardData }) {
  const image = coverImage(product);
  const flags = productFlags(product);
  return (
    <article className="card">
      <Link to={`/product/${product.id}`}>
        <div className="card-photo">
          {image ? <img src={image} alt={product.name} /> : <div className="photo-fallback" />}
          {flags.isNew || flags.onSale ? (
            <div className="flags">
              {flags.isNew ? <span className="flag">New</span> : null}
              {flags.onSale ? <span className="flag">Sale</span> : null}
            </div>
          ) : null}
        </div>
        <h3>{product.name}</h3>
        <p className="price">
          {money(flags.price)}
          {flags.compare != null ? <s>{money(flags.compare)}</s> : null}
        </p>
      </Link>
    </article>
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
