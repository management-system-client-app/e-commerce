import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, hydrateImages } from "../api";
import { categoryTiles } from "../components/Chrome";
import { ProductCarousel } from "../components/ProductCard";
import { useStore } from "../state";
import type { HomeBlock, HomePayload, ProductCardData } from "../types";

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
  active = true,
}: {
  block: HomeBlock;
  className?: string;
  overlayText?: string;
  href?: string;
  active?: boolean;
}) {
  return (
    <Link className={className} to={href ?? blockHref(block)}>
      {block.imageUrl ? (
        isVideoUrl(block.imageUrl) ? (
          <video
            src={block.imageUrl}
            autoPlay={active}
            muted
            loop
            playsInline
            preload={active ? "auto" : "none"}
          />
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
  const { catalog, catalogReady, categoryImages, settings } = useStore();
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
  const skeletonRef = useRef<HTMLDivElement>(null);
  const [reservedHeight, setReservedHeight] = useState(0);
  const isLoading = loading || !catalogReady;

  async function applyHomePayload(home: HomePayload) {
    setBanners(home.banners);
    setCampaigns(home.campaigns);
    const arrivalBlock = home.newArrivals[0];
    setArrivals(arrivalBlock?.products ?? []);
    setArrivalHref(arrivalBlock?.categoryId ? `/shop?categoryId=${arrivalBlock.categoryId}` : "/shop?sort=latest");
    setSelectedTrending(await hydrateImages(home.trendingProducts));
  }

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
    Promise.all([api.home(true), loadAvailableProducts(), api.bestSellers()])
      .then(async ([home, availableProducts, sellers]) => {
        if (!active) return;
        await applyHomePayload(home);
        setTrending(await hydrateImages(availableProducts));
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
    let active = true;
    let refreshing = false;
    const refreshHome = () => {
      if (!active || refreshing || document.visibilityState !== "visible") return;
      refreshing = true;
      api.home(true)
        .then(async (home) => {
          if (!active) return;
          await applyHomePayload(home);
          setError("");
        })
        .catch((reason: unknown) => {
          if (active) setError(reason instanceof Error ? reason.message : "Home could not be refreshed");
        })
        .finally(() => {
          refreshing = false;
        });
    };
    const timer = window.setInterval(refreshHome, 30_000);
    window.addEventListener("focus", refreshHome);
    document.addEventListener("visibilitychange", refreshHome);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshHome);
      document.removeEventListener("visibilitychange", refreshHome);
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
  const categoryCollage = [
    { imageUrl: settings.collageManImageUrl, label: "Man", href: "/shop?gender=MEN" },
    { imageUrl: settings.collageWomanImageUrl, label: "Woman", href: "/women" },
    { imageUrl: settings.collageChildImageUrl, label: "Child", href: "/shop?gender=KIDS" },
    { imageUrl: settings.collageAccessoriesImageUrl, label: "Accessories", href: "/shop" },
  ];
  const tiles = categoryTiles(catalog.categories, categoryImages);
  const deals = trending.filter((product) => product.onSale).length > 0 ? trending.filter((product) => product.onSale) : trending;
  const collection = arrivals.length > 0 ? arrivals : trending;
  const countdown = getCountdownParts(timeLeft);
  const hasHomeContent = Boolean(
    current || sideBanners.length || mosaicLarge.length || mosaicSmall.length || tiles.length || deals.length || collection.length || best.length || selectedTrending.length,
  );

  return (
    <div className="home" style={!isLoading && !error && hasHomeContent && reservedHeight ? { minHeight: reservedHeight } : undefined}>
      {isLoading ? <div className="home-skeleton-measure" ref={skeletonRef}><HomeSkeleton /></div> : (
        <>
      {error ? <p className="error">{error}</p> : null}
      {current || sideBanners.length > 0 ? (
        <div className="hero-board">
          {current ? (
            <div className="hero-main">
              <div className="hero-slides">
                {banners.map((banner, index) => {
                  const active = index === slide;
                  return (
                    <div
                      key={banner.id}
                      className={`hero-slide${active ? " is-active" : ""}`}
                      aria-hidden={!active}
                      inert={!active}
                    >
                      <BlockLink block={banner} active={active} />
                    </div>
                  );
                })}
              </div>
              {banners.length > 1 ? (
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
              ) : null}
            </div>
          ) : null}
          {sideBanners.length > 0 ? (
            <div className="hero-side">
              {sideBanners.map((campaign) => (
                <BlockLink key={campaign.id} block={campaign} className="hero-wide" />
              ))}
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

      {categoryCollage.some((item) => item.imageUrl) ? (
        <section className="section collage-wrap">
          <div className="collage-grid">
            {categoryCollage.map((item) => (
              <Link key={item.label} to={item.href} className="collage-card">
                {item.imageUrl ? <img src={item.imageUrl} alt={item.label} /> : <span className="collage-empty">{item.label}</span>}
                <span className="collage-label">{item.label}</span>
              </Link>
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
