import { useState, type FormEvent } from "react";
import "./StaticPages.css";

export function ContactPage() {
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="container section static-page">
      <h1 className="page-title">İletişim</h1>
      <p className="page-lead">Sipariş, toptan ve ürün sorularınız için yazın.</p>

      <div className="contact-grid">
        <div className="contact-info">
          <p>
            <strong>E-posta</strong>
            <br />
            info@marinanargile.com
          </p>
          <p>
            <strong>Telefon / WhatsApp</strong>
            <br />
            +90 555 123 45 67
          </p>
          <p>
            <strong>Çalışma saatleri</strong>
            <br />
            Pzt–Cmt 10:00–19:00
          </p>
        </div>

        {sent ? (
          <div className="notice">Mesajınız alındı (demo). En kısa sürede dönüş yapılacak.</div>
        ) : (
          <form className="form-stack contact-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="name">Ad Soyad</label>
              <input id="name" name="name" required />
            </div>
            <div className="field">
              <label htmlFor="email">E-posta</label>
              <input id="email" name="email" type="email" required />
            </div>
            <div className="field">
              <label htmlFor="message">Mesaj</label>
              <textarea id="message" name="message" required />
            </div>
            <button type="submit" className="btn">
              Gönder
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
