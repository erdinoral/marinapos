import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import "./AuthConfirmPage.css";

type ConfirmKind = "signup" | "recovery" | "email_change" | "unknown" | "error";

function readHashParams(): URLSearchParams {
  const raw = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(raw);
}

function detectKind(): { kind: ConfirmKind; errorMessage: string } {
  const query = new URLSearchParams(window.location.search);
  const hash = readHashParams();
  const error =
    query.get("error_description") ||
    query.get("error") ||
    hash.get("error_description") ||
    hash.get("error");
  if (error) {
    return { kind: "error", errorMessage: decodeURIComponent(error.replace(/\+/g, " ")) };
  }
  const type = (hash.get("type") || query.get("type") || "").toLowerCase();
  if (type === "recovery") return { kind: "recovery", errorMessage: "" };
  if (type === "email_change") return { kind: "email_change", errorMessage: "" };
  if (type === "signup" || type === "email" || type === "invite") {
    return { kind: "signup", errorMessage: "" };
  }
  if (hash.get("access_token") || query.get("code")) {
    return { kind: "signup", errorMessage: "" };
  }
  return { kind: "unknown", errorMessage: "" };
}

function getSupabase(): SupabaseClient | null {
  const url = (import.meta.env.VITE_SUPABASE_URL || "").trim();
  const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
  if (!url || !anon) return null;
  return createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}

export function AuthConfirmPage() {
  const initial = useMemo(() => detectKind(), []);
  const [kind, setKind] = useState<ConfirmKind>(initial.kind);
  const [errorMessage, setErrorMessage] = useState(initial.errorMessage);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetOk, setResetOk] = useState(false);
  const [formMsg, setFormMsg] = useState("");

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const code = new URLSearchParams(window.location.search).get("code");
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session && kind === "unknown") {
          setKind("signup");
        }
      } catch (e) {
        if (!cancelled) {
          setKind("error");
          setErrorMessage(e instanceof Error ? e.message : "Doğrulama tamamlanamadı.");
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind]);

  const submitRecovery = async (e: FormEvent) => {
    e.preventDefault();
    setFormMsg("");
    if (password.length < 6) {
      setFormMsg("Yeni şifre en az 6 karakter olmalı.");
      return;
    }
    if (password !== password2) {
      setFormMsg("Şifreler eşleşmiyor.");
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setFormMsg(
        "Bu sayfa için Supabase ayarı eksik. Marina POS uygulamasından şifre sıfırlamayı deneyin."
      );
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut();
      setResetOk(true);
      setKind("signup");
    } catch (err) {
      setFormMsg(err instanceof Error ? err.message : "Şifre güncellenemedi.");
    } finally {
      setBusy(false);
    }
  };

  const title =
    kind === "error"
      ? "Doğrulama başarısız"
      : kind === "recovery" && !resetOk
        ? "Yeni şifre belirleyin"
        : kind === "email_change"
          ? "E-posta güncellendi"
          : kind === "unknown"
            ? "Üyelik onayı"
            : "E-posta doğrulandı";

  const lead =
    kind === "error"
      ? errorMessage || "Link geçersiz veya süresi dolmuş olabilir."
      : kind === "recovery" && !resetOk
        ? "Üyelik şifrenizi aşağıdan yenileyin. Bu işlem PIN kodunuzu değiştirmez."
        : kind === "email_change"
          ? "Yeni e-posta adresiniz onaylandı. Marina POS uygulamasına dönüp giriş yapabilirsiniz."
          : kind === "unknown"
            ? "E-postadaki doğrulama linkine tıkladığınızda bu sayfa açılır. Ardından Marina POS uygulamasından giriş yapın."
            : "Hesabınız hazır. Bu sekmeyi kapatıp Marina POS uygulamasını açın ve e-posta ile giriş yapın.";

  return (
    <div className="auth-confirm">
      <div className="auth-confirm__panel">
        <p className="auth-confirm__brand">Marina Nargile</p>
        <div
          className={`auth-confirm__icon ${
            kind === "error" ? "is-error" : kind === "unknown" ? "is-wait" : "is-ok"
          }`}
          aria-hidden
        >
          {kind === "error" ? "!" : kind === "unknown" ? "i" : "✓"}
        </div>
        <h1 className="auth-confirm__title">{title}</h1>
        <p className="auth-confirm__lead">{ready ? lead : "Doğrulama kontrol ediliyor…"}</p>

        {kind === "recovery" && !resetOk && ready ? (
          <form className="auth-confirm__form" onSubmit={submitRecovery}>
            <label>
              Yeni şifre
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </label>
            <label>
              Yeni şifre (tekrar)
              <input
                type="password"
                autoComplete="new-password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                minLength={6}
                required
              />
            </label>
            {formMsg ? <p className="auth-confirm__err">{formMsg}</p> : null}
            <button type="submit" className="btn" disabled={busy}>
              {busy ? "Kaydediliyor…" : "Şifreyi kaydet"}
            </button>
          </form>
        ) : null}

        {kind !== "error" && kind !== "unknown" && (kind !== "recovery" || resetOk) ? (
          <ol className="auth-confirm__steps">
            <li>Bu tarayıcı sekmesini kapatabilirsiniz.</li>
            <li>
              Bilgisayarınızdaki <strong>Marina POS</strong> uygulamasını açın.
            </li>
            <li>Üyelik e-posta ve şifrenizle giriş yapın.</li>
          </ol>
        ) : null}

        {kind === "error" ? (
          <p className="auth-confirm__hint">
            Yeni doğrulama için Marina POS üzerinden tekrar kayıt olun veya şifre sıfırlama isteyin.
          </p>
        ) : null}

        <div className="auth-confirm__links">
          <Link to="/">Ana sayfa</Link>
        </div>
      </div>
    </div>
  );
}
