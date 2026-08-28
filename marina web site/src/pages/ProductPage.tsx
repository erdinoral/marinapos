import { Link, useParams } from "react-router-dom";
import { getProduct, formatPrice, products } from "../data/products";
import { getCategory } from "../data/categories";
import { useCart } from "../context/CartContext";
import { ProductCard } from "../components/ProductCard";
import { useState } from "react";
import "./CatalogPages.css";

export function ProductPage() {
  const { slug = "" } = useParams();
  const product = getProduct(slug);
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (!product) {
    return (
      <div className="container section">
        <h1 className="page-title">Ürün bulunamadı</h1>
        <Link to="/" className="btn">
          Ana sayfa
        </Link>
      </div>
    );
  }

  const category = getCategory(product.categorySlug);
  const related = products
    .filter((p) => p.categorySlug === product.categorySlug && p.id !== product.id)
    .slice(0, 4);

  const handleAdd = () => {
    addItem(product.id, qty);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="container section">
      <nav className="breadcrumb">
        <Link to="/">Ana sayfa</Link>
        <span>/</span>
        {category ? (
          <>
            <Link to={`/kategori/${category.slug}`}>{category.name}</Link>
            <span>/</span>
          </>
        ) : null}
        <span>{product.name}</span>
      </nav>

      <div className="product-detail">
        <div
          className="product-detail-media"
          style={{ background: `linear-gradient(145deg, ${product.imageTone}55, var(--media-end))` }}
        >
          <span>MN</span>
        </div>
        <div className="product-detail-info">
          <p className="product-detail-brand">{product.brand}</p>
          <h1 className="page-title">{product.name}</h1>
          <p className="price product-detail-price">
            {product.compareAt ? (
              <span className="price-old">{formatPrice(product.compareAt)}</span>
            ) : null}
            {formatPrice(product.price)}
            <span className="vat-note">KDV dahil</span>
          </p>
          <p className="product-detail-desc">{product.description}</p>

          {product.specs ? (
            <ul className="spec-list">
              {product.specs.map((s) => (
                <li key={s.label}>
                  <strong>{s.label}</strong>
                  <span>{s.value}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="product-buy-row">
            <label className="qty-field">
              Adet
              <input
                type="number"
                min={1}
                max={20}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
            <button type="button" className="btn" onClick={handleAdd}>
              {added ? "Eklendi ✓" : "Sepete Ekle"}
            </button>
          </div>
        </div>
      </div>

      {related.length > 0 ? (
        <section className="related-section">
          <h2>Benzer ürünler</h2>
          <div className="product-grid">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
