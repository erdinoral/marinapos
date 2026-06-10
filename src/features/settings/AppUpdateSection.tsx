import { useCallback, useEffect, useState } from "react";
import { getMarinaApi } from "../../api/marinaClient";
import type { AppUpdateInfo } from "../../types/models";
import { githubReleasesPageUrl } from "../../config/githubRelease";

function formatBytes(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function phaseLabel(info: AppUpdateInfo): string {
  switch (info.phase) {
    case "checking":
      return "Guncelleme kontrol ediliyor...";
    case "available":
      return info.latestVersion ? `Yeni surum: ${info.latestVersion}` : "Yeni surum mevcut";
    case "not-available":
      return "Uygulama guncel.";
    case "downloading":
      return info.percent != null ? `Indiriliyor... %${Math.round(info.percent)}` : "Indiriliyor...";
    case "downloaded":
      return info.latestVersion
        ? `Surum ${info.latestVersion} indirildi. Kurmak icin yeniden baslatin.`
        : "Guncelleme indirildi. Kurmak icin yeniden baslatin.";
    case "error":
      return info.error ?? "Guncelleme hatasi";
    default:
      return info.devMode
        ? "Gelistirme modunda otomatik guncelleme kapali."
        : "GitHub Release uzerinden guncelleme kontrol edilir.";
  }
}

export function AppUpdateSection() {
  const [info, setInfo] = useState<AppUpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const row = await getMarinaApi().getAppUpdateInfo();
      setInfo(row);
    } catch {
      setInfo(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const api = getMarinaApi();
    if (!api.onAppUpdateState) return;
    const unsub = api.onAppUpdateState((row) => setInfo(row));
    return unsub;
  }, [refresh]);

  const check = async () => {
    setBusy(true);
    try {
      const row = await getMarinaApi().checkForAppUpdate();
      setInfo(row);
    } catch (e) {
      setInfo((prev) =>
        prev
          ? { ...prev, phase: "error", error: e instanceof Error ? e.message : "Kontrol basarisiz." }
          : prev
      );
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      const row = await getMarinaApi().downloadAppUpdate();
      setInfo(row);
    } catch (e) {
      setInfo((prev) =>
        prev
          ? { ...prev, phase: "error", error: e instanceof Error ? e.message : "Indirme basarisiz." }
          : prev
      );
    } finally {
      setBusy(false);
    }
  };

  const install = () => {
    getMarinaApi().installAppUpdate();
  };

  const current = info?.currentVersion ?? "—";
  const canCheck = info?.enabled !== false && !busy && info?.phase !== "checking" && info?.phase !== "downloading";
  const canDownload = Boolean(info?.enabled && info.phase === "available" && !busy);
  const canInstall = Boolean(info?.enabled && info.phase === "downloaded" && !busy);
  const showProgress = info?.phase === "downloading" && info.percent != null;

  return (
    <section className="settings-card settings-update-card">
      <div className="settings-card-head">
        <h3>Guncelleme</h3>
        <div className="settings-card-actions">
          <button type="button" className="app-btn-secondary" disabled={!canCheck} onClick={() => void check()}>
            {busy && info?.phase === "checking" ? "Kontrol..." : "Guncellemeleri kontrol et"}
          </button>
        </div>
      </div>
      <p className="settings-update-version muted small">
        Kurulu surum: <strong>{current}</strong>
      </p>
      {info ? (
        <p
          className={`settings-update-status small${info.phase === "error" ? " settings-update-status--error" : ""}${info.phase === "available" || info.phase === "downloaded" ? " settings-update-status--ok" : ""}`}
        >
          {phaseLabel(info)}
        </p>
      ) : null}
      {showProgress ? (
        <div className="settings-update-progress" role="progressbar" aria-valuenow={info.percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="settings-update-progress-bar" style={{ width: `${Math.min(100, Math.max(0, info.percent ?? 0))}%` }} />
        </div>
      ) : null}
      {info?.phase === "downloading" && info.total ? (
        <p className="muted small settings-update-bytes">
          {formatBytes(info.transferred)} / {formatBytes(info.total)}
        </p>
      ) : null}
      {info?.phase === "error" ? (
        <p className="muted small settings-update-hint settings-update-hint--error">
          Gecici GitHub hatasi olabilir. <strong>Surumler sayfasi</strong> dugmesinden Setup dosyasini elle indirip kurabilirsiniz.
        </p>
      ) : null}
      {info?.releaseNotes?.trim() ? (
        <pre className="settings-update-notes">{info.releaseNotes.trim().slice(0, 800)}</pre>
      ) : null}
      <div className="settings-update-actions">
        {canDownload ? (
          <button type="button" className="primary app-btn-primary" disabled={busy} onClick={() => void download()}>
            Guncellemeyi indir
          </button>
        ) : null}
        {canInstall ? (
          <button type="button" className="primary app-btn-primary" disabled={busy} onClick={install}>
            Yeniden baslat ve kur
          </button>
        ) : null}
        <button
          type="button"
          className="app-btn-secondary"
          disabled={busy}
          onClick={() => void getMarinaApi().openExternalUrl(info?.releasePageUrl ?? githubReleasesPageUrl())}
        >
          Surumler sayfasi
        </button>
      </div>
      <p className="muted small settings-update-hint">
        Yeni surumler GitHub Release uzerinden dagitilir. Verileriniz (satis, stok, ayarlar) guncellemeden sonra da kalir.
      </p>
    </section>
  );
}
