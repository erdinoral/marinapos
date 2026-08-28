import { useState, type KeyboardEvent } from "react";
import {
  requestAccountPasswordReset,
  signInAccount,
  signUpAccount
} from "../../services/accountAuth";

type AuthMode = "login" | "register";

type Props = {
  onAuthenticated: () => void;
};

export function AccountAuthPanel({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);

  const submit = async () => {
    setMsg("");
    setMsgOk(false);
    const mail = email.trim();
    if (!mail) {
      setMsg("E-posta gerekli.");
      return;
    }
    if (!password || password.length < 6) {
      setMsg("Sifre en az 6 karakter olmali.");
      return;
    }
    if (mode === "register") {
      if (!displayName.trim()) {
        setMsg("Ad soyad gerekli.");
        return;
      }
      if (password !== password2) {
        setMsg("Sifreler eslesmiyor.");
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "login") {
        await signInAccount(mail, password);
        onAuthenticated();
        return;
      }
      const result = await signUpAccount({
        email: mail,
        password,
        displayName: displayName.trim()
      });
      if (result.needsEmailConfirmation) {
        setMsgOk(true);
        setMsg(
          "Kayit olusturuldu. E-postadaki dogrulama linkine tiklayin (acilan sayfa onay verir), sonra Marina POS'ta giris yapin."
        );
        setMode("login");
        setPassword("");
        setPassword2("");
        return;
      }
      if (result.user) onAuthenticated();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Islem basarisiz.");
    } finally {
      setBusy(false);
    }
  };

  const sendReset = async () => {
    setMsg("");
    setMsgOk(false);
    const mail = email.trim();
    if (!mail.includes("@")) {
      setMsg("Sifirlama icin e-posta adresinizi yazin.");
      return;
    }
    setBusy(true);
    try {
      await requestAccountPasswordReset(mail);
      setMsgOk(true);
      setMsg("Sifre sifirlama linki e-postaniza gonderildi (uyelik sifresi). PIN icin degil.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "E-posta gonderilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const onFormKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="account-auth-panel" onKeyDown={onFormKeyDown}>
      <div className="account-auth-tabs" role="tablist" aria-label="Giris veya kayit">
        <button
          type="button"
          role="tab"
          className={mode === "login" ? "active" : ""}
          aria-selected={mode === "login"}
          onClick={() => {
            setMode("login");
            setMsg("");
          }}
        >
          Giris yap
        </button>
        <button
          type="button"
          role="tab"
          className={mode === "register" ? "active" : ""}
          aria-selected={mode === "register"}
          onClick={() => {
            setMode("register");
            setMsg("");
          }}
        >
          Kayit ol
        </button>
      </div>

      <div className="account-auth-fields">
        {mode === "register" ? (
          <label className="account-field">
            <span>Ad soyad</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              disabled={busy}
              placeholder="Ornek: Ahmet Yilmaz"
            />
          </label>
        ) : null}

        <label className="account-field">
          <span>E-posta</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={busy}
            placeholder="ornek@firma.com"
          />
        </label>
        <label className="account-field">
          <span>Sifre</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            disabled={busy}
            placeholder={mode === "register" ? "En az 6 karakter" : ""}
          />
        </label>
        {mode === "register" ? (
          <label className="account-field">
            <span>Sifre tekrar</span>
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              autoComplete="new-password"
              disabled={busy}
            />
          </label>
        ) : null}
      </div>

      {msg ? <p className={`account-auth-message${msgOk ? " account-auth-message--ok" : ""}`}>{msg}</p> : null}

      <button type="button" className="account-auth-submit" disabled={busy} onClick={() => void submit()}>
        {busy ? "Bekleyin…" : mode === "login" ? "Giris yap" : "Hesap olustur"}
      </button>
      {mode === "login" ? (
        <button type="button" className="account-auth-forgot" disabled={busy} onClick={() => void sendReset()}>
          Uyelik sifremi unuttum
        </button>
      ) : null}
    </div>
  );
}
