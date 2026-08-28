import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./AuthPages.css";

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  if (user) {
    return <Navigate to="/hesabim" replace />;
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "").trim();
    if (!email.includes("@")) {
      setError("Geçerli bir e-posta girin.");
      return;
    }
    login(email);
    navigate("/hesabim");
  };

  return (
    <div className="container section auth-page">
      <h1 className="page-title">Giriş</h1>
      <p className="page-lead">
        Demo üyelik — gerçek kimlik doğrulama yakında. Oturum yalnızca bu tarayıcıda saklanır.
      </p>
      <form className="form-stack" onSubmit={handleSubmit}>
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
            autoComplete="current-password"
            placeholder="Demo — kontrol edilmez"
          />
        </div>
        {error ? <p className="auth-error">{error}</p> : null}
        <button type="submit" className="btn">
          Giriş yap
        </button>
      </form>
      <p className="auth-switch">
        Hesabınız yok mu? <Link to="/uye-ol">Üye olun</Link>
      </p>
    </div>
  );
}
