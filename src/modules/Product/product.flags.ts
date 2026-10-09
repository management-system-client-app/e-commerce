const NEW_PRODUCT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

type PricedProduct = {
  basePrice: { toString(): string } | number | string;
  compareAtPrice: { toString(): string } | number | string | null;
  createdAt: Date | string;
};

export const withProductFlags = <T extends PricedProduct>(product: T) => {
  const price = Number(product.basePrice);
  const compareAt = product.compareAtPrice == null ? null : Number(product.compareAtPrice);
  const createdAt = new Date(product.createdAt).getTime();

  return {
    ...product,
    onSale: compareAt != null && compareAt > price,
    isNew: Number.isFinite(createdAt) && Date.now() - createdAt < NEW_PRODUCT_WINDOW_MS,
  };
};
