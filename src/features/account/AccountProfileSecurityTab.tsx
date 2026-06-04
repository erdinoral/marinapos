import { useEffect, useState } from "react";
import {
  changeAccountPassword,
  getAccountSecurityInfo,
  signOutAllDevices,
  type AccountSecurityInfo
} from "../../services/accountAuth";

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

export function AccountProfileSecurityTab() {
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);
  const [security, setSecurity] = useState<AccountSecurityInfo | null>(null);

  useEffect(() => {
    void getAccountSecurityInfo().then(setSecurity);
  }, []);

  const submit = async () => {
    setMsg("");
    setMsgOk(false);
    if (password.length < 6) {
      setMsg("Sifre en az 6 karakter olmali.");
      return;
    }
    if (password !== password2) {
      setMsg("Sifreler eslesmiyor.");
      return;
    }
    setBusy(true);
    try {
      await changeAccountPassword(password);
      setPassword("");
      setPassword2("");
      setMsgOk(true);
      setMsg("Sifreniz guncellendi.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Sifre degistirilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const signOutEverywhere = async () => {
    if (!window.confirm("Tum cihazlardaki oturumlar kapatilsin mi? Bu cihazda da tekrar giris gerekir.")) return;
    setBusy(true);
    setMsg("");
    setMsgOk(false);
    try {
      await signOutAllDevices();
      setMsgOk(true);
      setMsg("Tum oturumlar kapatildi. Sayfa yenileniyor…");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Oturumlar kapatilamadi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="account-panel-card account-profile-card">
      <h3 className="account-profile-card-title">Guvenlik</h3>

      {security ? (
        <dl className="account-profile-dl account-profile-security-summary">
          <div>
            <dt>E-posta dogrulama</dt>
            <dd>{security.emailConfirmed ? "Dogrulandi" : "Bekliyor"}</dd>
          </div>
          <div>
            <dt>Son giris</dt>
            <dd>{formatDateTime(security.lastSignInAt)}</dd>
          </div>
        </dl>
      ) : null}

      <p className="muted small account-profile-section-lead">
        Oturum acikken yeni sifre belirleyebilirsiniz. Sifre degisikliginden sonra diger cihazlarda tekrar giris gerekebilir.
      </p>
      <div className="account-auth-fields account-profile-fields">
        <label className="account-field">
          <span>Yeni sifre</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            disabled={busy}
            placeholder="En az 6 karakter"
          />
        </label>
        <label className="account-field">
          <span>Yeni sifre (tekrar)</span>
          <input
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            autoComplete="new-password"
            disabled={busy}
          />
        </label>
      </div>
      {msg ? <p className={`account-auth-message${msgOk ? " account-auth-message--ok" : ""}`}>{msg}</p> : null}
      <div className="account-profile-actions account-profile-actions--stack">
        <button type="button" className="account-auth-submit" disabled={busy} onClick={() => void submit()}>
          {busy ? "Kaydediliyor…" : "Sifreyi guncelle"}
        </button>
        <button type="button" className="account-signout-btn" disabled={busy} onClick={() => void signOutEverywhere()}>
          Tum cihazlardan cikis
        </button>
      </div>
    </section>
  );
}
