import { useEffect, useState } from "react";
import type { AccountUser } from "../../types/account";
import { signOutAccount, updateAccountProfile } from "../../services/accountAuth";

type Props = {
  user: AccountUser;
  onUserChange: (user: AccountUser) => void;
  onSignedOut: () => void;
};

function formatAccountDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("tr-TR", { dateStyle: "long" });
}

export function AccountProfileInfoTab({ user, onUserChange, onSignedOut }: Props) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);

  useEffect(() => {
    setDisplayName(user.displayName);
  }, [user.displayName]);

  const saveProfile = async () => {
    if (!displayName.trim()) {
      setMsg("Ad soyad bos olamaz.");
      setMsgOk(false);
      return;
    }
    setBusy(true);
    setMsg("");
    setMsgOk(false);
    try {
      const updated = await updateAccountProfile({ displayName: displayName.trim() });
      onUserChange(updated);
      setMsgOk(true);
      setMsg("Profil guncellendi.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Profil kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    setMsg("");
    try {
      await signOutAccount();
      onSignedOut();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Cikis yapilamadi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="account-profile-tab">
      <section className="account-panel-card account-profile-card">
        <h3 className="account-profile-card-title">Kisisel bilgiler</h3>
        <div className="account-auth-fields account-profile-fields">
          <label className="account-field">
            <span>Ad soyad</span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={busy} />
          </label>
          <label className="account-field">
            <span>E-posta</span>
            <input value={user.email} readOnly disabled className="readonly" />
          </label>
        </div>
        <p className="muted small account-profile-meta">Uyelik: {formatAccountDate(user.createdAt)}</p>
        <p className="muted small account-profile-meta">Isletme bilgileri icin <strong>Firma bilgileri</strong> sekmesine gidin.</p>
        {msg ? <p className={`account-auth-message${msgOk ? " account-auth-message--ok" : ""}`}>{msg}</p> : null}
        <div className="account-profile-actions">
          <button type="button" className="account-auth-submit account-profile-save" disabled={busy} onClick={() => void saveProfile()}>
            Kaydet
          </button>
          <button type="button" className="account-signout-btn" disabled={busy} onClick={() => void signOut()}>
            Cikis yap
          </button>
        </div>
      </section>
    </div>
  );
}
