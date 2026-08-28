import { useEffect, useState } from "react";
import {
  changeAppPin,
  hasAppPinConfigured,
  hasRecoveryKeyConfigured,
  isValidPinFormat,
  isValidRecoveryKeyFormat,
  normalizePin,
  normalizeRecoveryKey,
  setAppPin
} from "../../services/appPin";

type Props = {
  active?: boolean;
};

export function AccountProfilePinTab({ active = true }: Props) {
  const [pinCurrent, setPinCurrent] = useState("");
  const [pinNew, setPinNew] = useState("");
  const [pinNew2, setPinNew2] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [recoveryKey2, setRecoveryKey2] = useState("");
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [hasRecovery, setHasRecovery] = useState(false);

  const refresh = () => {
    setHasPin(hasAppPinConfigured());
    setHasRecovery(hasRecoveryKeyConfigured());
  };

  useEffect(() => {
    if (!active) return;
    refresh();
  }, [active]);

  const submitPin = async () => {
    setMsg("");
    setMsgOk(false);
    const next = normalizePin(pinNew);
    const next2 = normalizePin(pinNew2);
    if (!isValidPinFormat(next)) {
      setMsg("Yeni PIN 4–6 haneli rakam olmali.");
      return;
    }
    if (next !== next2) {
      setMsg("Yeni PIN kodlari eslesmiyor.");
      return;
    }

    const wantRecovery = normalizeRecoveryKey(recoveryKey);
    const wantRecovery2 = normalizeRecoveryKey(recoveryKey2);
    const mustSetRecovery = !hasRecovery || wantRecovery.length > 0;
    if (mustSetRecovery) {
      if (!isValidRecoveryKeyFormat(wantRecovery)) {
        setMsg("Guvenlik anahtari en az 6 karakter olmali.");
        return;
      }
      if (wantRecovery !== wantRecovery2) {
        setMsg("Guvenlik anahtarlari eslesmiyor.");
        return;
      }
    }

    setBusy(true);
    try {
      if (hasPin) {
        await changeAppPin(pinCurrent, next, mustSetRecovery ? wantRecovery : undefined);
      } else {
        if (!isValidRecoveryKeyFormat(wantRecovery)) {
          throw new Error("Guvenlik anahtari zorunlu (en az 6 karakter).");
        }
        await setAppPin(next, wantRecovery);
      }
      setPinCurrent("");
      setPinNew("");
      setPinNew2("");
      setRecoveryKey("");
      setRecoveryKey2("");
      refresh();
      setMsgOk(true);
      setMsg(
        hasPin
          ? "PIN guncellendi. Sonraki acilista yeni kod istenir."
          : "PIN ve guvenlik anahtari olusturuldu. Uygulama acilisinda PIN istenir."
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "PIN kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="account-panel-card account-profile-card account-pin-card">
      <h3 className="account-profile-card-title">Uygulama PIN</h3>
      <p className="muted small account-profile-section-lead">
        Acilista istenen 4–6 haneli kod. Uyelik zorunlu degil. Unuttuysaniz acilis ekraninda{" "}
        <strong>guvenlik anahtari</strong> ile sifirlayabilirsiniz.
      </p>

      <div className={`account-pin-status${hasPin ? " account-pin-status--ok" : ""}`}>
        <strong>Durum:</strong>{" "}
        {hasPin
          ? hasRecovery
            ? "PIN + guvenlik anahtari tanimli"
            : "PIN var, guvenlik anahtari eksik — asagidan ekleyin"
          : "PIN henuz yok — asagidan olusturun"}
      </div>

      <div className="account-auth-fields account-profile-fields">
        {hasPin ? (
          <label className="account-field">
            <span>Mevcut PIN</span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinCurrent}
              onChange={(e) => setPinCurrent(normalizePin(e.target.value))}
              disabled={busy}
              autoComplete="off"
            />
          </label>
        ) : null}
        <label className="account-field">
          <span>{hasPin ? "Yeni PIN" : "PIN olustur"}</span>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pinNew}
            onChange={(e) => setPinNew(normalizePin(e.target.value))}
            disabled={busy}
            placeholder="4–6 hane"
            autoComplete="new-password"
          />
        </label>
        <label className="account-field">
          <span>PIN tekrar</span>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pinNew2}
            onChange={(e) => setPinNew2(normalizePin(e.target.value))}
            disabled={busy}
            autoComplete="new-password"
          />
        </label>
        <label className="account-field">
          <span>{hasRecovery ? "Yeni guvenlik anahtari (istege bagli)" : "Guvenlik anahtari (zorunlu)"}</span>
          <input
            type="password"
            value={recoveryKey}
            onChange={(e) => setRecoveryKey(e.target.value)}
            disabled={busy}
            placeholder="En az 6 karakter — unutmayin"
            autoComplete="new-password"
          />
        </label>
        <label className="account-field">
          <span>Guvenlik anahtari tekrar</span>
          <input
            type="password"
            value={recoveryKey2}
            onChange={(e) => setRecoveryKey2(e.target.value)}
            disabled={busy}
            autoComplete="new-password"
          />
        </label>
      </div>
      {msg ? <p className={`account-auth-message${msgOk ? " account-auth-message--ok" : ""}`}>{msg}</p> : null}
      <button type="button" className="account-auth-submit" disabled={busy} onClick={() => void submitPin()}>
        {busy ? "Kaydediliyor…" : hasPin ? "PIN guncelle" : "PIN olustur"}
      </button>
    </section>
  );
}
