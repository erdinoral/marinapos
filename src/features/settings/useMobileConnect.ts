import { useCallback, useEffect, useMemo, useState } from "react";
import { getMarinaApi } from "../../api/marinaClient";
import type { MobileLanStatus } from "../../types/models";

function statusLabel(status: MobileLanStatus | null): string {
  if (!status) return "Yükleniyor…";
  if (!status.enabled) return "Kapalı";
  if (status.running) return "Açık — telefon bağlanabilir";
  return "Açık ama sunucu başlatılamadı (port meşgul olabilir)";
}

function formatApkSize(bytes: number): string {
  if (bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}

export function useMobileConnect(active: boolean) {
  const [status, setStatus] = useState<MobileLanStatus | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [apkQrDataUrl, setApkQrDataUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const refresh = useCallback(async () => {
    const api = getMarinaApi();
    if (
      typeof api.getMobileLanStatus !== "function" ||
      typeof api.getMobileLanQrDataUrl !== "function" ||
      typeof api.getMobileApkQrDataUrl !== "function"
    ) {
      setStatus(null);
      setQrDataUrl("");
      setApkQrDataUrl("");
      setMsg("Mobil bağlantı yalnızca kurulu PC uygulamasında (Electron) kullanılabilir.");
      return;
    }
    const [nextStatus, qrUrl, apkUrl] = await Promise.all([
      api.getMobileLanStatus(),
      api.getMobileLanQrDataUrl(),
      api.getMobileApkQrDataUrl()
    ]);
    setStatus(nextStatus);
    setQrDataUrl(nextStatus.enabled && qrUrl ? qrUrl : "");
    setApkQrDataUrl(nextStatus.enabled && apkUrl ? apkUrl : "");
  }, []);

  useEffect(() => {
    if (!active) return;
    void refresh();
    const id = window.setInterval(() => void refresh(), 8000);
    return () => window.clearInterval(id);
  }, [active, refresh]);

  const toggleEnabled = async () => {
    if (!status) return;
    setBusy(true);
    setMsg("");
    try {
      const next = await getMarinaApi().setMobileLanEnabled(!status.enabled);
      setStatus(next);
      await refresh();
      setMsg(next.enabled ? "Yerel ağ sunucusu açıldı. Önce APK QR, sonra bağlantı QR okutun." : "Mobil bağlantı kapatıldı.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Ayar kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    if (!window.confirm("Yeni QR üretilir. Eski telefon bağlantıları geçersiz olur. Devam?")) return;
    setBusy(true);
    setMsg("");
    try {
      await getMarinaApi().regenerateMobileLanToken();
      await refresh();
      setMsg("Yeni bağlantı kodu üretildi.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Kod üretilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const connectionHint = useMemo(() => {
    if (!status?.enabled) return null;
    return `http://${status.host}:${status.port}`;
  }, [status]);

  const apkHint = useMemo(() => {
    if (!status?.apkAvailable) return null;
    return `${status.apkInstallPageUrl} (${formatApkSize(status.apkSizeBytes)})`;
  }, [status]);

  return {
    status,
    qrDataUrl,
    apkQrDataUrl,
    busy,
    msg,
    connectionHint,
    apkHint,
    statusLabel: statusLabel(status),
    toggleEnabled,
    regenerate,
    refresh
  };
}
