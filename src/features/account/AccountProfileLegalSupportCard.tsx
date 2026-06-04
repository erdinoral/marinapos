import type { LegalKind } from "../legal/LegalModal";

type Props = {
  onOpenLegal: (kind: LegalKind) => void;
};

export function AccountProfileLegalSupportCard({ onOpenLegal }: Props) {
  return (
    <section className="account-panel-card account-profile-card account-profile-app-card">
      <h3 className="account-profile-card-title">Yasal ve destek</h3>
      <div className="account-profile-legal-links">
        <button type="button" className="account-profile-link-btn" onClick={() => onOpenLegal("kvkk")}>
          KVKK aydinlatma
        </button>
        <button type="button" className="account-profile-link-btn" onClick={() => onOpenLegal("privacy")}>
          Gizlilik politikasi
        </button>
        <button type="button" className="account-profile-link-btn" onClick={() => onOpenLegal("terms")}>
          Kullanim kosullari
        </button>
      </div>
      <p className="account-profile-contact muted small">
        Soru ve oneriler: <a href="mailto:akiyom.iletisim@gmail.com">akiyom.iletisim@gmail.com</a>
      </p>
    </section>
  );
}
