import { Link } from "react-router-dom";
import "./StaticPages.css";

export function AboutPage() {
  return (
    <div className="container section static-page">
      <h1 className="page-title">Hakkımızda</h1>
      <p className="page-lead">
        Marina Nargile, orijinal nargile takımları ve malzemeleri sunan bir markadır.
      </p>
      <div className="prose">
        <p>
          Amacımız; dengeli çekiş, dayanıklı malzeme ve sade bir alışveriş deneyimi. Katalogumuz
          takımdan kömüre, lüleden yedek parçaya kadar uzanır.
        </p>
        <p>
          Online vitrinimiz <strong>marinanargile.com</strong> üzerinden hizmet verir. Mağaza ve
          toptan talepleriniz için iletişim sayfasından bize ulaşabilirsiniz.
        </p>
        <Link to="/iletisim" className="btn">
          İletişime geç
        </Link>
      </div>
    </div>
  );
}
