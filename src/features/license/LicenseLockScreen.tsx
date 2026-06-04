import { useState } from "react";
import { motion } from "framer-motion";
import type { LicenseStatus } from "../../services/licenseService";

interface Props {
  status: LicenseStatus | null;
  checking: boolean;
  onRetry: () => void | Promise<void>;
  onActivate?: (licenseKey: string) => Promise<void>;
}

export function LicenseLockScreen({ status, checking, onRetry, onActivate }: Props) {
  const [draftKey, setDraftKey] = useState("");
  const [activateError, setActivateError] = useState("");
  const [busy, setBusy] = useState(false);
  const deviceId = status?.deviceId ?? "—";
  const needsKey = status?.state === "needs_activation";
  const isBusy = checking || busy;

  const title = needsKey
    ? "Lisans anahtari"
    : status?.state === "pending"
      ? "Aktivasyon bekleniyor"
      : status?.state === "offline_expired"
        ? "Baglanti gerekli"
        : status?.state === "config_missing"
          ? "Yapilandirma eksik"
          : "Erisim kapatildi";

  const submitKey = async () => {
    if (!onActivate) {
      setActivateError("Lisans API baglantisi yok. Uygulamayi Electron ile acin.");
      return;
    }
    const key = draftKey.trim();
    if (key.length < 6) {
      setActivateError("Gecerli bir lisans anahtari girin (en az 6 karakter).");
      return;
    }
    setActivateError("");
    setBusy(true);
    try {
      await onActivate(key);
    } catch (e) {
      setActivateError(e instanceof Error ? e.message : "Anahtar kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const handleRetry = async () => {
    setActivateError("");
    setBusy(true);
    try {
      await Promise.resolve(onRetry());
    } catch (e) {
      setActivateError(e instanceof Error ? e.message : "Kontrol yapilamadi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="license-lock-screen">
      <motion.div className="license-lock-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1>{title}</h1>
        <p className="license-lock-message">
          {status?.message?.trim() ||
            (needsKey
              ? "Size verilen lisans anahtarini bir kez girin. Bu bilgisayara kaydedilir; normal kullanimda tekrar sorulmaz."
              : "Erisim uzaktan yonetilir; odeme veya sozlesme kosullarina gore acilir/kapanir.")}
        </p>

        {needsKey && onActivate ? (
          <div className="license-lock-activate">
            <label className="license-lock-activate-label">
              <span>Lisans anahtari</span>
              <input
                type="text"
                className="license-lock-key-input"
                placeholder="Orn. AKIYOM-XXXX-XXXX"
                value={draftKey}
                onChange={(e) => setDraftKey(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitKey();
                }}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            {activateError ? <p className="license-lock-activate-error">{activateError}</p> : null}
            <button type="button" className="license-lock-retry" disabled={isBusy} onClick={() => void submitKey()}>
              {isBusy ? "Kaydediliyor…" : "Anahtari kaydet ve ac"}
            </button>
          </div>
        ) : (
          <>
            <div className="license-lock-device">
              <span className="license-lock-device-label">Cihaz kodu</span>
              <code className="license-lock-device-id">{deviceId}</code>
              {status?.hasActivationKey ? (
                <p className="muted small">Lisans anahtari bu bilgisayara kayitli.</p>
              ) : (
                <p className="muted small">Anahtar yoksa destek ile iletisime gecin.</p>
              )}
            </div>
            <button type="button" className="license-lock-retry" disabled={isBusy} onClick={() => void handleRetry()}>
              {isBusy ? "Kontrol ediliyor…" : "Tekrar kontrol et"}
            </button>
          </>
        )}

        {status?.appCode ? (
          <p className="license-lock-meta muted small">
            Uygulama kodu (Supabase app_code): <code>{status.appCode}</code>
          </p>
        ) : null}
        {status?.lastCheckAt ? (
          <p className="license-lock-meta muted small">Son basarili kontrol: {new Date(status.lastCheckAt).toLocaleString("tr-TR")}</p>
        ) : null}
      </motion.div>
    </div>
  );
}
