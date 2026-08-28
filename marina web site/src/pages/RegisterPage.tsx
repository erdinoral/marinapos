import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./AuthPages.css";

export function RegisterPage() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  if (user) {
    return <Navigate to="/hesabim" replace />;
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim();
    if (!name || !email.includes("@")) {
      setError("Ad ve geçerli e-posta gerekli.");
      return;
    }
    register(name, email);
    navigate("/hesabim");
  };

  return (
    <div className="container section auth-page">
      <h1 className="page-title">Üye Ol</h1>
      <p className="page-lead">
        Üyelik altyapısı yakında. Şimdilik demo hesap oluşturup favori / sipariş stub’larını
        görebilirsiniz.
      </p>
      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="name">Ad Soyad</label>
          <input id="name" name="name" required autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="email">E-posta</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="password">Şifre</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="En az 6 karakter (demo)"
          />
        </div>
        {error ? <p className="auth-error">{error}</p> : null}
        <button type="submit" className="btn">
          Üye ol
        </button>
      </form>
      <p className="auth-switch">
        Zaten üye misiniz? <Link to="/giris">Giriş yapın</Link>
      </p>
    </div>
  );
}
