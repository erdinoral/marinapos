import { useEffect, useState } from "react";
import { getMarinaApi } from "../../api/marinaClient";
import type { LicenseStatus } from "../../types/models";

type Props = {
  onOpenSettings: () => void;
};

function licenseStateLabel(state: LicenseStatus["state"]): string {
  switch (state) {
    case "active":
      return "Aktif";
    case "pending":
      return "Beklemede";
    case "needs_activation":
      return "Aktivasyon gerekli";
    case "locked":
      return "Kilitli";
    case "offline_expired":
      return "Cevrimdisi / suresi doldu";
    case "config_missing":
      return "Yapilandirma yok";
    default:
      return state;
  }
}

function formatCheckDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

export function AccountProfileLicenseTab({ onOpenSettings }: Props) {
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [copyMsg, setCopyMsg] = useState("");

  useEffect(() => {
    void getMarinaApi()
      .checkLicense()
      .then(setLicense)
      .catch(() => setLicense(null));
  }, []);

  const copyDeviceId = async () => {
    if (!license?.deviceId) return;
    try {
      await navigator.clipboard.writeText(license.deviceId);
      setCopyMsg("Cihaz ID panoya kopyalandi.");
      window.setTimeout(() => setCopyMsg(""), 2500);
    } catch {
      setCopyMsg("Kopyalama basarisiz.");
    }
  };

  if (!license) {
    return (
      <section className="account-panel-card account-profile-card account-profile-license-card">
        <h3 className="account-profile-card-title">Lisans ozeti</h3>
        <p className="muted small account-profile-license-hint">Lisans bilgisi su anda alinamiyor.</p>
        <button type="button" className="account-profile-link-btn" onClick={onOpenSettings}>
          Ayarlara git
        </button>
      </section>
    );
  }

  return (
    <section className="account-panel-card account-profile-card account-profile-license-card">
      <h3 className="account-profile-card-title">Lisans ozeti</h3>
      <dl className="account-profile-dl">
        <div>
          <dt>Durum</dt>
          <dd>
            <span className={`account-license-badge account-license-badge--${license.state}`}>
              {licenseStateLabel(license.state)}
            </span>
          </dd>
        </div>
        <div>
          <dt>Son kontrol</dt>
          <dd>{formatCheckDate(license.lastCheckAt)}</dd>
        </div>
        <div>
          <dt>Anahtar</dt>
          <dd>{license.hasActivationKey ? "Kayitli" : "Yok"}</dd>
        </div>
        <div>
          <dt>Uygulama kodu</dt>
          <dd>
            <code>{license.appCode || "—"}</code>
          </dd>
        </div>
        <div>
          <dt>Cihaz</dt>
          <dd className="account-profile-dl-mono">{license.deviceId}</dd>
        </div>
      </dl>
      {license.message ? <p className="muted small account-profile-license-hint">{license.message}</p> : null}
      {copyMsg ? <p className="account-auth-message account-auth-message--ok">{copyMsg}</p> : null}
      <div className="account-profile-shortcuts">
        <button type="button" className="account-profile-link-btn" onClick={() => void copyDeviceId()}>
          Cihaz ID kopyala
        </button>
        <button type="button" className="account-profile-link-btn" onClick={onOpenSettings}>
          Lisans anahtari (Ayarlar)
        </button>
      </div>
    </section>
  );
}
