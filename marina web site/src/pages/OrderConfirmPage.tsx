import { Link, useLocation } from "react-router-dom";
import "./CartCheckout.css";

type OrderState = { orderId?: string };

export function OrderConfirmPage() {
  const location = useLocation();
  const state = (location.state as OrderState | null) ?? {};
  let orderId = state.orderId;

  if (!orderId) {
    try {
      const last = JSON.parse(localStorage.getItem("marina-last-order") || "null") as {
        id?: string;
      } | null;
      orderId = last?.id;
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="container section confirm-page">
      <p className="badge">Sipariş alındı</p>
      <h1 className="page-title">Teşekkürler</h1>
      <p className="page-lead">
        Siparişiniz demo olarak kaydedildi.
        {orderId ? (
          <>
            {" "}
            Sipariş no: <strong className="order-id">{orderId}</strong>
          </>
        ) : null}
      </p>
      <div className="confirm-actions">
        <Link to="/" className="btn">
          Ana sayfaya dön
        </Link>
        <Link to="/hesabim" className="btn btn-outline">
          Siparişlerim
        </Link>
      </div>
    </div>
  );
}
