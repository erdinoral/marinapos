import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatPrice } from "../data/products";
import "./AuthPages.css";

type StoredOrder = {
  id: string;
  createdAt: string;
  total: number;
};

export function AccountPage() {
  const { user, logout } = useAuth();

  let orders: StoredOrder[] = [];
  try {
    orders = JSON.parse(localStorage.getItem("marina-orders-v1") || "[]") as StoredOrder[];
  } catch {
    orders = [];
  }

  if (!user) {
    return (
      <div className="container section auth-page">
        <h1 className="page-title">Hesabım</h1>
        <p className="page-lead">Siparişlerinizi ve favorilerinizi görmek için giriş yapın.</p>
        <div className="auth-actions">
          <Link to="/giris" className="btn">
            Giriş
          </Link>
          <Link to="/uye-ol" className="btn btn-outline">
            Üye Ol
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container section">
      <div className="account-head">
        <div>
          <h1 className="page-title">Merhaba, {user.name}</h1>
          <p className="page-lead">{user.email}</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={logout}>
          Çıkış
        </button>
      </div>

      <div className="account-grid">
        <section className="account-panel">
          <h2>Siparişler</h2>
          {orders.length === 0 ? (
            <p className="muted">Henüz sipariş yok.</p>
          ) : (
            <ul className="order-list">
              {orders.map((o) => (
                <li key={o.id}>
                  <strong>{o.id}</strong>
                  <span>{new Date(o.createdAt).toLocaleDateString("tr-TR")}</span>
                  <span className="price">{formatPrice(o.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="account-panel">
          <h2>Favoriler</h2>
          <p className="muted">Favori listesi yakında — şimdilik placeholder.</p>
        </section>
      </div>
    </div>
  );
}
