import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import {
  hasAppPinConfigured,
  hasRecoveryKeyConfigured,
  isValidPinFormat,
  isValidRecoveryKeyFormat,
  normalizePin,
  normalizeRecoveryKey,
  resetPinWithRecoveryKey,
  setAppPin,
  verifyAppPin
} from "../../services/appPin";

type Phase = "loading" | "create" | "confirm" | "recovery" | "unlock" | "reset";

type Props = {
  onUnlocked: () => void;
};

export function PinLockScreen({ onUnlocked }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [draftPin, setDraftPin] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [recoveryKey2, setRecoveryKey2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const resolvePhase = useCallback(() => {
    setError("");
    setInfo("");
    if (hasAppPinConfigured()) {
      setPhase("unlock");
      return;
    }
    setPhase("create");
  }, []);

  useEffect(() => {
    resolvePhase();
  }, [resolvePhase]);

  const onPinChange = (value: string, which: "pin" | "pin2") => {
    const n = normalizePin(value);
    if (which === "pin") setPin(n);
    else setPin2(n);
    setError("");
  };

  const goConfirm = () => {
    setError("");
    if (!isValidPinFormat(pin)) {
      setError("PIN 4–6 haneli rakam olmali.");
      return;
    }
    setDraftPin(pin);
    setPin2("");
    setPhase("confirm");
  };

  const goRecovery = () => {
    setError("");
    if (pin2 !== draftPin) {
      setError("PIN kodlari eslesmiyor.");
      return;
    }
    if (!isValidPinFormat(draftPin)) {
      setError("PIN 4–6 haneli rakam olmali.");
      return;
    }
    setRecoveryKey("");
    setRecoveryKey2("");
    setPhase("recovery");
  };

  const savePin = async () => {
    setError("");
    const key = normalizeRecoveryKey(recoveryKey);
    const key2 = normalizeRecoveryKey(recoveryKey2);
    if (!isValidRecoveryKeyFormat(key)) {
      setError("Guvenlik anahtari en az 6 karakter olmali.");
      return;
    }
    if (key !== key2) {
      setError("Guvenlik anahtarlari eslesmiyor.");
      return;
    }
    setBusy(true);
    try {
      await setAppPin(draftPin, key);
      setPin("");
      setPin2("");
      setDraftPin("");
      setRecoveryKey("");
      setRecoveryKey2("");
      onUnlocked();
    } catch (e) {
      setError(e instanceof Error ? e.message : "PIN kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const unlock = async () => {
    setError("");
    setBusy(true);
    try {
      const result = await verifyAppPin(pin);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPin("");
      onUnlocked();
    } finally {
      setBusy(false);
    }
  };

  const resetWithKey = async () => {
    setError("");
    setInfo("");
    setBusy(true);
    try {
      await resetPinWithRecoveryKey(recoveryKey);
      setRecoveryKey("");
      setRecoveryKey2("");
      setPin("");
      setPin2("");
      setDraftPin("");
      setPhase("create");
      setInfo("Guvenlik anahtari dogrulandi. Eski PIN silindi — yeni PIN ve yeni guvenlik anahtari olusturun.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sifirlama basarisiz.");
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent, action: () => void) => {
    if (e.key === "Enter") {
      e.preventDefault();
      action();
    }
  };

  const title =
    phase === "create"
      ? "PIN olustur"
      : phase === "confirm"
        ? "PIN onayla"
        : phase === "recovery"
          ? "Guvenlik anahtari"
          : phase === "unlock"
            ? "PIN ile giris"
            : phase === "reset"
              ? "PIN unuttum"
              : "Yukleniyor";

  const lead =
    phase === "create"
      ? "4–6 haneli bir PIN belirleyin. Her acilista bu kod istenir. Uyelik zorunlu degildir."
      : phase === "confirm"
        ? "PIN kodunu tekrar girerek onaylayin."
        : phase === "recovery"
          ? "Bir guvenlik anahtari belirtin. Bu anahtari unutmayin — PIN sifirlama adiminda sizden istenecektir. En az 6 karakter."
          : phase === "unlock"
            ? "Devam etmek icin PIN kodunuzu girin."
            : phase === "reset"
              ? hasRecoveryKeyConfigured()
                ? "PIN olustururken belirlediginiz guvenlik anahtarini girin. Dogruysa eski PIN silinir ve yenisini olustursunuz."
                : "Bu cihazda guvenlik anahtari kayitli degil (eski surum). PIN ile girip Hesap → PIN sekmesinden anahtar ekleyebilirsiniz."
              : "Kontrol ediliyor…";

  return (
    <div className="pin-lock-screen">
      <motion.div className="pin-lock-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1>{title}</h1>
        <p className="pin-lock-message">{lead}</p>
        {info ? <p className="pin-lock-info">{info}</p> : null}

        {phase === "loading" ? <p className="muted">Bekleyin…</p> : null}

        {phase === "create" ? (
          <div className="pin-lock-form" onKeyDown={(e) => onKeyDown(e, goConfirm)}>
            <label className="pin-lock-field">
              <span>Yeni PIN</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={pin}
                onChange={(e) => onPinChange(e.target.value, "pin")}
                placeholder="••••"
                disabled={busy}
                autoFocus
              />
            </label>
            {error ? <p className="pin-lock-error">{error}</p> : null}
            <button type="button" className="pin-lock-btn" disabled={busy} onClick={goConfirm}>
              Devam — onayla
            </button>
          </div>
        ) : null}

        {phase === "confirm" ? (
          <div className="pin-lock-form" onKeyDown={(e) => onKeyDown(e, goRecovery)}>
            <label className="pin-lock-field">
              <span>PIN tekrar</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={pin2}
                onChange={(e) => onPinChange(e.target.value, "pin2")}
                placeholder="••••"
                disabled={busy}
                autoFocus
              />
            </label>
            {error ? <p className="pin-lock-error">{error}</p> : null}
            <div className="pin-lock-actions">
              <button
                type="button"
                className="pin-lock-btn pin-lock-btn--ghost"
                disabled={busy}
                onClick={() => {
                  setPhase("create");
                  setPin(draftPin);
                  setPin2("");
                  setError("");
                }}
              >
                Geri
              </button>
              <button type="button" className="pin-lock-btn" disabled={busy} onClick={goRecovery}>
                Devam — guvenlik anahtari
              </button>
            </div>
          </div>
        ) : null}

        {phase === "recovery" ? (
          <div className="pin-lock-form" onKeyDown={(e) => onKeyDown(e, () => void savePin())}>
            <p className="pin-lock-warn">
              Bu anahtari guvenli bir yere not edin. Unutursaniz PIN sifirlamak icin baska yol yoktur.
            </p>
            <label className="pin-lock-field">
              <span>Guvenlik anahtari</span>
              <input
                type="password"
                autoComplete="new-password"
                value={recoveryKey}
                onChange={(e) => {
                  setRecoveryKey(e.target.value);
                  setError("");
                }}
                placeholder="En az 6 karakter"
                disabled={busy}
                autoFocus
              />
            </label>
            <label className="pin-lock-field">
              <span>Guvenlik anahtari (tekrar)</span>
              <input
                type="password"
                autoComplete="new-password"
                value={recoveryKey2}
                onChange={(e) => {
                  setRecoveryKey2(e.target.value);
                  setError("");
                }}
                placeholder="Tekrar yazin"
                disabled={busy}
              />
            </label>
            {error ? <p className="pin-lock-error">{error}</p> : null}
            <div className="pin-lock-actions">
              <button
                type="button"
                className="pin-lock-btn pin-lock-btn--ghost"
                disabled={busy}
                onClick={() => {
                  setPhase("confirm");
                  setRecoveryKey("");
                  setRecoveryKey2("");
                  setError("");
                }}
              >
                Geri
              </button>
              <button type="button" className="pin-lock-btn" disabled={busy} onClick={() => void savePin()}>
                {busy ? "Kaydediliyor…" : "Olustur ve gir"}
              </button>
            </div>
          </div>
        ) : null}

        {phase === "unlock" ? (
          <div className="pin-lock-form" onKeyDown={(e) => onKeyDown(e, () => void unlock())}>
            <label className="pin-lock-field">
              <span>PIN kodu</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={pin}
                onChange={(e) => onPinChange(e.target.value, "pin")}
                placeholder="••••"
                disabled={busy}
                autoFocus
              />
            </label>
            {error ? <p className="pin-lock-error">{error}</p> : null}
            <button type="button" className="pin-lock-btn" disabled={busy} onClick={() => void unlock()}>
              {busy ? "Kontrol…" : "Giris yap"}
            </button>
            <button
              type="button"
              className="pin-lock-btn pin-lock-btn--ghost"
              disabled={busy}
              onClick={() => {
                setError("");
                setInfo("");
                setRecoveryKey("");
                setPhase("reset");
              }}
            >
              PIN unuttum
            </button>
          </div>
        ) : null}

        {phase === "reset" ? (
          <div className="pin-lock-form" onKeyDown={(e) => onKeyDown(e, () => void resetWithKey())}>
            {hasRecoveryKeyConfigured() ? (
              <label className="pin-lock-field">
                <span>Guvenlik anahtari</span>
                <input
                  type="password"
                  autoComplete="off"
                  value={recoveryKey}
                  onChange={(e) => {
                    setRecoveryKey(e.target.value);
                    setError("");
                  }}
                  placeholder="PIN olustururken belirlediginiz anahtar"
                  disabled={busy}
                  autoFocus
                />
              </label>
            ) : null}
            {error ? <p className="pin-lock-error">{error}</p> : null}
            {hasRecoveryKeyConfigured() ? (
              <button type="button" className="pin-lock-btn" disabled={busy} onClick={() => void resetWithKey()}>
                {busy ? "Dogrulaniyor…" : "Anahtari dogrula — PIN sifirla"}
              </button>
            ) : (
              <p className="pin-lock-warn">
                Eski surum PIN&apos;inde guvenlik anahtari yok. PIN&apos;i hatirlamiyorsaniz destek ile iletisime gecin
                veya uygulama verisini sifirlayin. Tek tikla kaldirma guvenlik nedeniyle kapali.
              </p>
            )}
            <button
              type="button"
              className="pin-lock-btn pin-lock-btn--ghost"
              disabled={busy}
              onClick={() => {
                setPhase("unlock");
                setRecoveryKey("");
                setError("");
                setInfo("");
              }}
            >
              Geri — PIN gir
            </button>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
