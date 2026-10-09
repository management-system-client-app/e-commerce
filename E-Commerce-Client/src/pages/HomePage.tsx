import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, hydrateImages } from "../api";
import { categoryTiles } from "../components/Chrome";
import { ProductCarousel } from "../components/ProductCard";
import { useStore } from "../state";
import type { HomeBlock, ProductCardData } from "../types";

const getCountdownParts = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds };
};

function isVideoUrl(value: string | null | undefined) {
  if (!value) return false;
  return /(\.(mp4|webm|mov|m4v|ogv|avi))(\?.*)?$/i.test(value) || /(?:^|\/)(video|mp4|webm|quicktime)/i.test(value);
}

function hasAvailableStock(product: ProductCardData) {
  return product.variants?.some((variant) => variant.stock - (variant.reserved ?? 0) > 0) ?? false;
}

async function loadAvailableProducts() {
  const products: ProductCardData[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const result = await api.products({
      status: "ACTIVE",
      sort: "latest",
      inStock: true,
      limit: 100,
      page,
    });
    products.push(...result.items.filter(hasAvailableStock));
    totalPages = result.meta.totalPages;
    page += 1;
  }

  return products;
}

function blockHref(block: HomeBlock) {
  if (block.linkUrl) return block.linkUrl;
  if (block.categoryId) return `/shop?categoryId=${block.categoryId}`;
  return "/shop";
}

function BlockLink({
  block,
  className,
  overlayText,
  href,
}: {
  block: HomeBlock;
  className?: string;
  overlayText?: string;
  href?: string;
}) {
  return (
    <Link className={className} to={href ?? blockHref(block)}>
      {block.imageUrl ? (
        isVideoUrl(block.imageUrl) ? (
          <video src={block.imageUrl} autoPlay muted loop playsInline preload="auto" />
        ) : (
          <img src={block.imageUrl} alt={block.title} />
        )
      ) : (
        <div className="banner-copy">
          <strong>{block.title}</strong>
          {block.subtitle ? <span>{block.subtitle}</span> : null}
        </div>
      )}
      {overlayText ? <span className="collage-label">{overlayText}</span> : null}
    </Link>
  );
}

function HomeSkeleton() {
  return (
    <div className="home-skeleton" aria-hidden="true">
      <div className="skeleton-hero" />
      <section className="skeleton-section">
        <div className="skeleton-heading" />
        <div className="skeleton-categories">
          {Array.from({ length: 6 }, (_, index) => <div className="skeleton-category" key={index} />)}
        </div>
      </section>
      {Array.from({ length: 3 }, (_, row) => (
        <section className="skeleton-section" key={row}>
          <div className="skeleton-heading" />
          <div className="skeleton-products">
            {Array.from({ length: 5 }, (_, index) => <div className="skeleton-product" key={index} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

export function HomePage() {
  const { catalog, catalogReady, categoryImages } = useStore();
  const [banners, setBanners] = useState<HomeBlock[]>([]);
  const [campaigns, setCampaigns] = useState<HomeBlock[]>([]);
  const [arrivals, setArrivals] = useState<ProductCardData[]>([]);
  const [arrivalHref, setArrivalHref] = useState("/shop?sort=latest");
  const [trending, setTrending] = useState<ProductCardData[]>([]);
  const [selectedTrending, setSelectedTrending] = useState<ProductCardData[]>([]);
  const [best, setBest] = useState<ProductCardData[]>([]);
  const [slide, setSlide] = useState(0);
  const [saleEndsAt] = useState(() => Date.now() + 1000 * 60 * 60 * 12 + 1000 * 30);
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, saleEndsAt - Date.now()));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const categoryRow = useRef<HTMLDivElement>(null);
  const skeletonRef = useRef<HTMLDivElement>(null);
  const [reservedHeight, setReservedHeight] = useState(0);
  const isLoading = loading || !catalogReady;

  useLayoutEffect(() => {
    if (!isLoading || !skeletonRef.current) return;
    const skeleton = skeletonRef.current;
    const measure = () => setReservedHeight(skeleton.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(skeleton);
    return () => observer.disconnect();
  }, [isLoading]);

  useEffect(() => {
    let active = true;
    Promise.all([api.home(), loadAvailableProducts(), api.bestSellers()])
      .then(async ([home, availableProducts, sellers]) => {
        if (!active) return;
        setBanners(home.banners);
        setCampaigns(home.campaigns);
        const arrivalBlock = home.newArrivals[0];
        setArrivals(arrivalBlock?.products ?? []);
        setArrivalHref(arrivalBlock?.categoryId ? `/shop?categoryId=${arrivalBlock.categoryId}` : "/shop?sort=latest");
        setTrending(await hydrateImages(availableProducts));
        setSelectedTrending(home.trendingProducts);
        setBest(sellers);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Home could not be loaded");
      })
      .finally(() => {
        if (active) setLoading(false);
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

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeLeft(Math.max(0, saleEndsAt - Date.now()));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [saleEndsAt]);

  const current = banners[slide] ?? banners[0];
  const sideBanners = campaigns.slice(0, 3);
  const mosaicLarge = campaigns.slice(3, 5);
  const mosaicSmall = campaigns.slice(5, 9);
  const featureCollage = campaigns.slice(0, 4);
  const tiles = categoryTiles(catalog.categories, categoryImages);
  const deals = trending.filter((product) => product.onSale).length > 0 ? trending.filter((product) => product.onSale) : trending;
  const collection = arrivals.length > 0 ? arrivals : trending;
  const countdown = getCountdownParts(timeLeft);
  const hasHomeContent = Boolean(
    current || sideBanners.length || tiles.length || deals.length || mosaicLarge.length || mosaicSmall.length || collection.length || best.length || selectedTrending.length,
  );

  function moveCategories(direction: -1 | 1) {
    categoryRow.current?.scrollBy({ left: direction * categoryRow.current.clientWidth * 0.75, behavior: "smooth" });
  }

  return (
    <div className="home" style={!isLoading && !error && hasHomeContent && reservedHeight ? { minHeight: reservedHeight } : undefined}>
      {isLoading ? <div className="home-skeleton-measure" ref={skeletonRef}><HomeSkeleton /></div> : (
        <>
      {error ? <p className="error">{error}</p> : null}
      {current || sideBanners.length > 0 ? (
        <div className="hero-board">
          {current ? (
            <div className="hero-main">
              <BlockLink block={current} />
              {banners.length > 1 ? (
                <>
                  <button type="button" className="hero-arrow hero-prev" aria-label="Previous banner" onClick={() => setSlide((slide - 1 + banners.length) % banners.length)}>‹</button>
                  <button type="button" className="hero-arrow hero-next" aria-label="Next banner" onClick={() => setSlide((slide + 1) % banners.length)}>›</button>
                  <div className="dots">
                    {banners.map((banner, index) => (
                      <button
                        key={banner.id}
                        type="button"
                        className={index === slide ? "dot active" : "dot"}
                        aria-label={`Show banner ${index + 1}`}
                        onClick={() => setSlide(index)}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
          {sideBanners.length > 0 ? (
            <div className="hero-side">
              {sideBanners.map((block) => (
                <BlockLink key={block.id} block={block} className="hero-wide" />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {tiles.length > 0 ? (
        <section className="section">
          <div className="section-head">
            <h2>Popular Categories</h2>
            {tiles.length > 5 ? (
              <div className="shelf-controls">
                <button type="button" aria-label="Previous categories" onClick={() => moveCategories(-1)}>‹</button>
                <button type="button" aria-label="Next categories" onClick={() => moveCategories(1)}>›</button>
              </div>
            ) : null}
          </div>
          <div className="cat-row" ref={categoryRow}>
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
            <div className="deal-header-wrap">
              <h2>Daily Deals</h2>
              <div className="countdown-box" aria-live="polite">
                <span>Ends in</span>
                <div className="countdown-stack">
                  <strong>{String(countdown.hours).padStart(2, "0")}</strong>
                  <small>H</small>
                </div>
                <div className="countdown-stack">
                  <strong>{String(countdown.minutes).padStart(2, "0")}</strong>
                  <small>M</small>
                </div>
                <div className="countdown-stack">
                  <strong>{String(countdown.seconds).padStart(2, "0")}</strong>
                  <small>S</small>
                </div>
              </div>
            </div>
            <Link className="see-more" to="/shop?sort=price_asc">
              See More
            </Link>
          </div>
          <ProductCarousel products={deals} showAvailableStock />
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

      {featureCollage.length >= 4 ? (
        <section className="section collage-wrap">
          <div className="collage-grid">
            {featureCollage.map((block, index) => (
              <BlockLink
                key={block.id}
                block={block}
                className="collage-card"
                overlayText={["Man", "Woman", "Child", "Accessories"][index]}
                href={index === 1 ? "/women" : undefined}
              />
            ))}
          </div>
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
          <ProductCarousel products={collection} />
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
          <ProductCarousel products={best} />
        </section>
      ) : null}

      {selectedTrending.length > 0 ? (
        <section className="section">
          <div className="section-head">
            <h2>Trending Now</h2>
            <Link className="see-more" to="/shop">
              See More
            </Link>
          </div>
          <ProductCarousel products={selectedTrending} />
        </section>
      ) : null}
        </>
      )}
    </div>
  );
}
