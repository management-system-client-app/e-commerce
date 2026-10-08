import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, hydrateImages } from "../api";
import { categoryTiles } from "../components/Chrome";
import { ProductCard } from "../components/ProductCard";
import { useStore } from "../state";
import type { HomeBlock, ProductCardData } from "../types";

function blockHref(block: HomeBlock) {
  if (block.linkUrl) return block.linkUrl;
  if (block.categoryId) return `/shop?categoryId=${block.categoryId}`;
  return "/shop";
}

export function HomePage() {
  const { catalog, categoryImages } = useStore();
  const [banners, setBanners] = useState<HomeBlock[]>([]);
  const [campaigns, setCampaigns] = useState<HomeBlock[]>([]);
  const [arrivals, setArrivals] = useState<ProductCardData[]>([]);
  const [arrivalHref, setArrivalHref] = useState("/shop?sort=latest");
  const [trending, setTrending] = useState<ProductCardData[]>([]);
  const [best, setBest] = useState<ProductCardData[]>([]);
  const [slide, setSlide] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([api.home(), api.products({ status: "ACTIVE", sort: "latest", limit: 8, page: 1 }), api.bestSellers()])
      .then(async ([home, latest, sellers]) => {
        if (!active) return;
        setBanners(home.banners);
        setCampaigns(home.campaigns);
        const arrivalBlock = home.newArrivals[0];
        setArrivals(arrivalBlock?.products ?? []);
        setArrivalHref(arrivalBlock?.categoryId ? `/shop?categoryId=${arrivalBlock.categoryId}` : "/shop?sort=latest");
        setTrending(await hydrateImages(latest.items));
        setBest(sellers);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Home could not be loaded");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (banners.length < 2) return;
    const timer = window.setInterval(() => {
      setSlide((current) => (current + 1) % banners.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [banners.length]);

  const current = banners[slide] ?? banners[0];
  const sideWide = campaigns[0];
  const sidePair = campaigns.slice(1, 3);
  const mosaicLarge = campaigns.slice(3, 5);
  const mosaicSmall = campaigns.slice(5, 9);
  const tiles = categoryTiles(catalog.categories, categoryImages);
  const deals = trending.filter((product) => product.onSale).length > 0 ? trending.filter((product) => product.onSale) : trending;
  const collection = arrivals.length > 0 ? arrivals : trending;

  function BlockLink({ block, className }: { block: HomeBlock; className?: string }) {
    return (
      <Link className={className} to={blockHref(block)}>
        {block.imageUrl ? <img src={block.imageUrl} alt={block.title} /> : (
          <div className="banner-copy">
            <strong>{block.title}</strong>
            {block.subtitle ? <span>{block.subtitle}</span> : null}
          </div>
        )}
      </Link>
    );
  }

  return (
    <div className="home">
      {error ? <p className="error">{error}</p> : null}
      {current || sideWide ? (
        <div className="hero-board">
          {current ? (
            <div className="hero-main">
              <BlockLink block={current} />
              {banners.length > 1 ? (
                <div className="dots">
                  {banners.map((banner, index) => (
                    <button
                      key={banner.id}
                      type="button"
                      className={index === slide ? "dot active" : "dot"}
                      aria-label={String(index + 1)}
                      onClick={() => setSlide(index)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {sideWide || sidePair.length > 0 ? (
            <div className="hero-side">
              {sideWide ? <BlockLink block={sideWide} className="hero-wide" /> : null}
              {sidePair.length > 0 ? (
                <div className="hero-pair">
                  {sidePair.map((block) => (
                    <BlockLink key={block.id} block={block} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {tiles.length > 0 ? (
        <section className="section">
          <div className="section-head">
            <h2>Popular Categories</h2>
          </div>
          <div className="cat-row">
            {tiles.map(({ category, image }) => (
              <Link key={category.id} to={`/shop?categoryId=${category.id}`} className="cat-tile">
                <div className="cat-photo">
                  {image ? <img src={image} alt="" /> : <span>{category.name.slice(0, 1)}</span>}
                </div>
                <span>{category.name}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {deals.length > 0 ? (
        <section className="section deals">
          <div className="section-head">
            <h2>Daily Deals</h2>
            <Link className="see-more" to="/shop?sort=price_asc">
              See More
            </Link>
          </div>
          <div className="product-row">
            {deals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      {mosaicLarge.length > 0 ? (
        <section className="section mosaic mosaic-2">
          {mosaicLarge.map((block) => (
            <BlockLink key={block.id} block={block} />
          ))}
        </section>
      ) : null}

      {mosaicSmall.length > 0 ? (
        <section className="section mosaic mosaic-4">
          {mosaicSmall.map((block) => (
            <BlockLink key={block.id} block={block} />
          ))}
        </section>
      ) : null}

      {collection.length > 0 ? (
        <section className="section">
          <div className="section-head">
            <h2>New Collection</h2>
            <Link className="see-more" to={arrivalHref}>
              See More
            </Link>
          </div>
          <div className="product-row">
            {collection.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      {best.length > 0 ? (
        <section className="section">
          <div className="section-head">
            <h2>Best Sellers</h2>
            <Link className="see-more" to="/shop">
              See More
            </Link>
          </div>
          <div className="product-row">
            {best.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
