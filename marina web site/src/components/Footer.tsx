import { Link } from "react-router-dom";
import logo from "../assets/marina-logo.png";
import { categories } from "../data/categories";
import "./Footer.css";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">
            <img src={logo} alt="" />
            <span>Marina Nargile</span>
          </Link>
          <p>
            Orijinal nargile takımları, kömür, lüle ve malzemeler. marinanargile.com üzerinden
            güvenli alışveriş.
          </p>
        </div>

        <div>
          <h3>Kategoriler</h3>
          <ul>
            {categories.slice(0, 6).map((c) => (
              <li key={c.slug}>
                <Link to={`/kategori/${c.slug}`}>{c.name}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3>Kurumsal</h3>
          <ul>
            <li>
              <Link to="/hakkimizda">Hakkımızda</Link>
            </li>
            <li>
              <Link to="/iletisim">İletişim</Link>
            </li>
            <li>
              <Link to="/rehber">Rehber</Link>
            </li>
            <li>
              <Link to="/hesabim">Hesabım</Link>
            </li>
          </ul>
        </div>

        <div>
          <h3>İletişim</h3>
          <ul className="footer-contact">
            <li>info@marinanargile.com</li>
            <li>+90 555 123 45 67</li>
            <li>Pzt–Cmt 10:00–19:00</li>
          </ul>
          <div className="trust-row">
            <span>SSL</span>
            <span>KDV Dahil</span>
            <span>Güvenli Ödeme</span>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container">
          © {new Date().getFullYear()} Marina Nargile · marinanargile.com
        </div>
      </div>
    </footer>
  );
}
