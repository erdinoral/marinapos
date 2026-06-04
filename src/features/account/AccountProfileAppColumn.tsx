import { useEffect, useState } from "react";
import { getMarinaApi } from "../../api/marinaClient";
import { APP_RELEASE_DATE, APP_VERSION } from "./accountReleaseNotes";

type Props = {
  onOpenSettings: () => void;
};

function fmtBackupDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

export function AccountProfileAppColumn({ onOpenSettings }: Props) {
  const [lastBackupLabel, setLastBackupLabel] = useState<string | null>(null);

  useEffect(() => {
    void getMarinaApi()
      .listBackups()
      .then((rows) => {
        const latest = rows[0];
        setLastBackupLabel(latest ? fmtBackupDate(latest.createdAt) : null);
      })
      .catch(() => setLastBackupLabel(null));
  }, []);

  return (
    <div className="account-profile-app-column">
      <section className="account-panel-card account-profile-card account-profile-app-card">
        <h3 className="account-profile-card-title">Uygulama</h3>
        <p className="account-profile-version">
          Surum <strong>{APP_VERSION}</strong>
          <span className="muted small"> · {APP_RELEASE_DATE}</span>
        </p>
        {lastBackupLabel ? (
          <p className="muted small account-profile-meta">Son yedek: {lastBackupLabel}</p>
        ) : (
          <p className="muted small account-profile-meta">Henuz yerel yedek yok.</p>
        )}
        <div className="account-profile-shortcuts">
          <button type="button" className="account-profile-link-btn" onClick={onOpenSettings}>
            Ayarlar (yedek, log)
          </button>
          <button type="button" className="account-profile-link-btn" onClick={onOpenSettings}>
            Lisans anahtari
          </button>
        </div>
      </section>
    </div>
  );
}
