import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCategory } from "../data/categories";
import { getProductsByCategory, formatPrice } from "../data/products";
import { ProductCard } from "../components/ProductCard";
import "./CatalogPages.css";

type SortKey = "featured" | "price-asc" | "price-desc" | "name";

export function CategoryPage() {
  const { slug = "" } = useParams();
  const category = getCategory(slug);
  const [sort, setSort] = useState<SortKey>("featured");
  const [onlyNew, setOnlyNew] = useState(false);

  const items = useMemo(() => {
    let list = getProductsByCategory(slug);
    if (onlyNew) list = list.filter((p) => p.isNew);
    const sorted = [...list];
    if (sort === "price-asc") sorted.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") sorted.sort((a, b) => b.price - a.price);
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "tr"));
    return sorted;
  }, [slug, sort, onlyNew]);

  if (!category) {
    return (
      <div className="container section">
        <h1 className="page-title">Kategori bulunamadı</h1>
        <Link to="/" className="btn">
          Ana sayfa
        </Link>
      </div>
    );
  }

  return (
    <div className="container section">
      <nav className="breadcrumb">
        <Link to="/">Ana sayfa</Link>
        <span>/</span>
        <span>{category.name}</span>
      </nav>
      <h1 className="page-title">{category.name}</h1>
      <p className="page-lead">{category.description}</p>

      <div className="catalog-toolbar">
        <label className="filter-check">
          <input
            type="checkbox"
            checked={onlyNew}
            onChange={(e) => setOnlyNew(e.target.checked)}
          />
          Sadece yeni
        </label>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="featured">Öne çıkan</option>
          <option value="price-asc">Fiyat: düşük → yüksek</option>
          <option value="price-desc">Fiyat: yüksek → düşük</option>
          <option value="name">İsim</option>
        </select>
        <span className="catalog-count">{items.length} ürün</span>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">Bu filtrede ürün yok.</div>
      ) : (
        <div className="product-grid">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      <p className="catalog-note">
        Fiyatlar KDV dahildir.
        {items.length > 0
          ? ` En düşük: ${formatPrice(Math.min(...items.map((i) => i.price)))}`
          : null}
      </p>
    </div>
  );
}
