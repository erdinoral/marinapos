import { Link } from "react-router-dom";
import { categories, FREE_SHIPPING_THRESHOLD } from "../data/categories";
import { getBestsellers, getNewProducts } from "../data/products";
import { guidePosts } from "../data/guides";
import { ProductCard } from "../components/ProductCard";
import "./HomePage.css";

export function HomePage() {
  const news = getNewProducts();
  const bestsellers = getBestsellers();

  return (
    <>
      <section className="hero">
        <div className="hero-bg" aria-hidden />
        <div className="container hero-content">
          <p className="hero-eyebrow fade-up">marinanargile.com</p>
          <h1 className="fade-up-delay">Marina Nargile</h1>
          <p className="hero-lead fade-up-delay-2">
            Orijinal takımlar, kömür ve malzemeler — {FREE_SHIPPING_THRESHOLD.toLocaleString("tr-TR")}{" "}
            TL üzeri kargo bedava.
          </p>
          <div className="hero-cta fade-up-delay-2">
            <Link to="/kategori/nargile-takimlari" className="btn">
              Takımları İncele
            </Link>
            <Link to="/kategori/komur" className="btn btn-outline">
              Kömürler
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <h2>Kategoriler</h2>
              <p>Nargile dünyasının tamamı tek vitrinde.</p>
            </div>
          </div>
          <div className="category-strip">
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                to={`/kategori/${cat.slug}`}
                className="category-tile"
              >
                <span>{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="section-head">
            <div>
              <h2>Yeni Ürünler</h2>
              <p>Vitrine yeni eklenenler.</p>
            </div>
            <Link to="/kategori/nargile-takimlari" className="section-link">
              Tümünü gör →
            </Link>
          </div>
          <div className="product-grid">
            {news.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <h2>Çok Satanlar</h2>
              <p>En çok tercih edilen Marina ürünleri.</p>
            </div>
          </div>
          <div className="product-grid">
            {bestsellers.slice(0, 8).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="section-head">
            <div>
              <h2>Rehber</h2>
              <p>Kurulum, kömür ve bakım ipuçları.</p>
            </div>
            <Link to="/rehber" className="section-link">
              Tüm yazılar →
            </Link>
          </div>
          <div className="guide-teaser">
            {guidePosts.slice(0, 3).map((post) => (
              <Link key={post.slug} to={`/rehber/${post.slug}`} className="guide-card">
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
                <span>{post.readMinutes} dk okuma</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
