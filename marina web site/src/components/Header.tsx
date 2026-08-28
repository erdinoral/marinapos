import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import logo from "../assets/marina-logo.png";
import { categories, FREE_SHIPPING_THRESHOLD } from "../data/categories";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { formatPrice } from "../data/products";
import "./Header.css";

export function Header() {
  const { itemCount, freeShippingRemaining, subtotal } = useCart();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="top-bar">
        <div className="container top-bar-inner">
          <span>{FREE_SHIPPING_THRESHOLD.toLocaleString("tr-TR")} TL üzeri kargo bedava</span>
          <span className="top-bar-sep">·</span>
          <span>Orijinal ürün garantisi</span>
          <span className="top-bar-sep">·</span>
          <a href="https://wa.me/905551234567" target="_blank" rel="noreferrer">
            WhatsApp Destek
          </a>
          <span className="top-bar-sep">·</span>
          <span>Pzt–Cmt 10:00–19:00</span>
        </div>
      </div>

      <div className="main-bar">
        <div className="container main-bar-inner">
          <button
            type="button"
            className="menu-toggle"
            aria-label="Menüyü aç"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>

          <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>
            <img src={logo} alt="" className="brand-logo" />
            <span className="brand-text">
              <strong>Marina</strong>
              <em>Nargile</em>
            </span>
          </Link>

          <nav className={`main-nav ${menuOpen ? "is-open" : ""}`}>
            {categories.map((cat) => (
              <NavLink
                key={cat.slug}
                to={`/kategori/${cat.slug}`}
                onClick={() => setMenuOpen(false)}
              >
                {cat.name}
              </NavLink>
            ))}
            <NavLink to="/rehber" onClick={() => setMenuOpen(false)}>
              Rehber
            </NavLink>
          </nav>

          <div className="header-actions">
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === "light" ? "Koyu moda geç" : "Açık moda geç"}
              title={theme === "light" ? "Koyu mod" : "Açık mod"}
            >
              {theme === "light" ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M21 14.3A8.5 8.5 0 0 1 9.7 3 7 7 0 1 0 21 14.3Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
                  <path
                    d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
            {user ? (
              <Link to="/hesabim" className="btn btn-ghost header-auth">
                {user.name}
              </Link>
            ) : (
              <>
                <Link to="/giris" className="btn btn-ghost header-auth">
                  Giriş
                </Link>
                <Link to="/uye-ol" className="btn btn-outline header-register">
                  Üye Ol
                </Link>
              </>
            )}
            <Link to="/sepet" className="cart-link" aria-label="Sepet">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M6 6h15l-1.5 9h-12L6 6Zm0 0L5 3H2"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="9" cy="20" r="1.2" fill="currentColor" />
                <circle cx="17" cy="20" r="1.2" fill="currentColor" />
              </svg>
              {itemCount > 0 ? <span className="cart-count">{itemCount}</span> : null}
            </Link>
          </div>
        </div>
      </div>

      {subtotal > 0 && freeShippingRemaining > 0 ? (
        <div className="ship-hint">
          <div className="container">
            Ücretsiz kargoya {formatPrice(freeShippingRemaining)} kaldı
          </div>
        </div>
      ) : null}
    </header>
  );
}
