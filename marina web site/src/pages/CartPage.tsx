import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { formatPrice } from "../data/products";
import { FREE_SHIPPING_THRESHOLD } from "../data/categories";
import "./CartCheckout.css";

export function CartPage() {
  const { lines, subtotal, shipping, total, freeShippingRemaining, setQty, removeItem, getLineProduct } =
    useCart();

  if (lines.length === 0) {
    return (
      <div className="container section">
        <h1 className="page-title">Sepet</h1>
        <div className="empty-state">
          <p>Sepetiniz boş.</p>
          <Link to="/" className="btn" style={{ marginTop: "1rem" }}>
            Alışverişe başla
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container section">
      <h1 className="page-title">Sepet</h1>
      {freeShippingRemaining > 0 ? (
        <p className="notice">
          Ücretsiz kargo için {formatPrice(freeShippingRemaining)} daha ekleyin (
          {FREE_SHIPPING_THRESHOLD.toLocaleString("tr-TR")} TL üzeri).
        </p>
      ) : (
        <p className="notice">Kargo ücretsiz — eşiği aştınız.</p>
      )}

      <div className="cart-layout">
        <div className="cart-lines">
          {lines.map((line) => {
            const product = getLineProduct(line.productId);
            if (!product) return null;
            return (
              <article key={line.productId} className="cart-line">
                <div
                  className="cart-line-thumb"
                  style={{ background: `linear-gradient(145deg, ${product.imageTone}55, var(--media-end))` }}
                />
                <div className="cart-line-info">
                  <Link to={`/urun/${product.slug}`}>
                    <h3>{product.name}</h3>
                  </Link>
                  <p>{formatPrice(product.price)}</p>
                  <div className="cart-line-actions">
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={line.qty}
                      onChange={(e) =>
                        setQty(line.productId, Math.max(1, Number(e.target.value) || 1))
                      }
                    />
                    <button type="button" className="btn-ghost" onClick={() => removeItem(line.productId)}>
                      Kaldır
                    </button>
                  </div>
                </div>
                <p className="price cart-line-total">{formatPrice(product.price * line.qty)}</p>
              </article>
            );
          })}
        </div>

        <aside className="cart-summary">
          <h2>Özet</h2>
          <div className="summary-row">
            <span>Ara toplam</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="summary-row">
            <span>Kargo</span>
            <span>{shipping === 0 ? "Ücretsiz" : formatPrice(shipping)}</span>
          </div>
          <div className="summary-row summary-total">
            <span>Toplam</span>
            <span className="price">{formatPrice(total)}</span>
          </div>
          <Link to="/odeme" className="btn btn-block">
            Ödemeye geç
          </Link>
        </aside>
      </div>
    </div>
  );
}
