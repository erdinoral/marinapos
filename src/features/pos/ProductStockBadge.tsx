import type { Category, Product } from "../../types/models";
import { productStockBadgeLabel, productStockBadgeLevel } from "../../utils/saleUnit";

type Props = {
  product: Product;
  categories: Category[];
  lowStockThreshold?: number;
  className?: string;
};

export function ProductStockBadge({ product, categories, lowStockThreshold = 10, className = "" }: Props) {
  const level = productStockBadgeLevel(product, categories, lowStockThreshold);
  const label = productStockBadgeLabel(product, categories);
  const title =
    level === "empty" ? "Stok yok" : level === "low" ? "Dusuk stok" : "Stokta mevcut";

  return (
    <span
      className={`product-stock-qty-badge product-stock-qty-badge--${level}${className ? ` ${className}` : ""}`}
      title={title}
    >
      {label}
    </span>
  );
}
