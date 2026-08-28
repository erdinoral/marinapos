import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { formatPrice } from "../data/products";
import "./CartCheckout.css";

type PaymentMethod = "card" | "transfer";

export function CheckoutPage() {
  const { lines, subtotal, shipping, total, clear, getLineProduct } = useCart();
  const navigate = useNavigate();
  const [payment, setPayment] = useState<PaymentMethod>("card");
  const [submitting, setSubmitting] = useState(false);

  if (lines.length === 0) {
    return <Navigate to="/sepet" replace />;
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const orderId = `MN-${Date.now().toString(36).toUpperCase()}`;
    const order = {
      id: orderId,
      createdAt: new Date().toISOString(),
      payment,
      customer: {
        name: String(form.get("name") || ""),
        phone: String(form.get("phone") || ""),
        email: String(form.get("email") || ""),
        city: String(form.get("city") || ""),
        district: String(form.get("district") || ""),
        address: String(form.get("address") || "")
      },
      lines: lines.map((l) => {
        const p = getLineProduct(l.productId);
        return {
          productId: l.productId,
          name: p?.name ?? "",
          qty: l.qty,
          price: p?.price ?? 0
        };
      }),
      subtotal,
      shipping,
      total
    };

    try {
      const prev = JSON.parse(localStorage.getItem("marina-orders-v1") || "[]") as unknown[];
      localStorage.setItem("marina-orders-v1", JSON.stringify([order, ...prev]));
      localStorage.setItem("marina-last-order", JSON.stringify(order));
    } catch {
      /* ignore */
    }
    clear();
    navigate("/siparis-onay", { state: { orderId } });
  };

  return (
    <div className="container section">
      <h1 className="page-title">Ödeme</h1>
      <p className="page-lead">
        Demo ödeme ekranı — gerçek POS / iyzico bağlantısı yok. Sipariş tarayıcıda kaydedilir.
      </p>

      <form className="checkout-layout" onSubmit={handleSubmit}>
        <div className="checkout-forms">
          <fieldset className="checkout-block">
            <legend>Teslimat adresi</legend>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="name">Ad Soyad</label>
                <input id="name" name="name" required autoComplete="name" />
              </div>
              <div className="field">
                <label htmlFor="phone">Telefon</label>
                <input id="phone" name="phone" type="tel" required autoComplete="tel" />
              </div>
              <div className="field field-full">
                <label htmlFor="email">E-posta</label>
                <input id="email" name="email" type="email" required autoComplete="email" />
              </div>
              <div className="field">
                <label htmlFor="city">İl</label>
                <input id="city" name="city" required />
              </div>
              <div className="field">
                <label htmlFor="district">İlçe</label>
                <input id="district" name="district" required />
              </div>
              <div className="field field-full">
                <label htmlFor="address">Adres</label>
                <textarea id="address" name="address" required />
              </div>
            </div>
          </fieldset>

          <fieldset className="checkout-block">
            <legend>Ödeme yöntemi</legend>
            <div className="pay-options">
              <label className={`pay-option ${payment === "card" ? "is-active" : ""}`}>
                <input
                  type="radio"
                  name="payment"
                  checked={payment === "card"}
                  onChange={() => setPayment("card")}
                />
                Kredi / banka kartı
              </label>
              <label className={`pay-option ${payment === "transfer" ? "is-active" : ""}`}>
                <input
                  type="radio"
                  name="payment"
                  checked={payment === "transfer"}
                  onChange={() => setPayment("transfer")}
                />
                Havale / EFT
              </label>
            </div>

            {payment === "card" ? (
              <div className="form-grid card-fields">
                <div className="field field-full">
                  <label htmlFor="cardName">Kart üzerindeki isim</label>
                  <input id="cardName" name="cardName" placeholder="Demo — kaydedilmez" />
                </div>
                <div className="field field-full">
                  <label htmlFor="cardNumber">Kart numarası</label>
                  <input id="cardNumber" name="cardNumber" placeholder="**** **** **** ****" />
                </div>
                <div className="field">
                  <label htmlFor="cardExp">SKT</label>
                  <input id="cardExp" name="cardExp" placeholder="AA/YY" />
                </div>
                <div className="field">
                  <label htmlFor="cardCvc">CVC</label>
                  <input id="cardCvc" name="cardCvc" placeholder="***" />
                </div>
              </div>
            ) : (
              <div className="notice" style={{ marginTop: "1rem", marginBottom: 0 }}>
                Sipariş sonrası IBAN bilgisi e-posta ile iletilecek (demo).
              </div>
            )}
          </fieldset>
        </div>

        <aside className="cart-summary">
          <h2>Sipariş özeti</h2>
          <ul className="checkout-items">
            {lines.map((line) => {
              const p = getLineProduct(line.productId);
              if (!p) return null;
              return (
                <li key={line.productId}>
                  <span>
                    {p.name} × {line.qty}
                  </span>
                  <span>{formatPrice(p.price * line.qty)}</span>
                </li>
              );
            })}
          </ul>
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
          <button type="submit" className="btn btn-block" disabled={submitting}>
            {submitting ? "İşleniyor…" : "Siparişi tamamla"}
          </button>
          <Link to="/sepet" className="back-cart">
            ← Sepete dön
          </Link>
        </aside>
      </form>
    </div>
  );
}
