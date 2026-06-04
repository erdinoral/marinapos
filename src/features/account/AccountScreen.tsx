import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getMarinaApi } from "../../api/marinaClient";
import type { AccountUser } from "../../types/account";
import {
  getAccountSession,
  isAccountAuthConfigured,
  subscribeAccountAuth
} from "../../services/accountAuth";
import type { LegalKind } from "../legal/LegalModal";
import { AccountAuthPanel } from "./AccountAuthPanel";
import { AccountProfilePanel } from "./AccountProfilePanel";

type Props = {
  onOpenSettings?: () => void;
  onOpenLegal?: (kind: LegalKind) => void;
  onCompanySaved?: () => void | Promise<void>;
};

export function AccountScreen({ onOpenSettings, onOpenLegal, onCompanySaved }: Props) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [feedbackConfigured, setFeedbackConfigured] = useState<boolean | null>(null);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [ok, feedbackOk] = await Promise.all([
        isAccountAuthConfigured(),
        getMarinaApi()
          .isFeedbackConfigured()
          .catch(() => false)
      ]);
      setConfigured(ok);
      setFeedbackConfigured(feedbackOk);
      if (!ok) {
        setUser(null);
        return;
      }
      const sessionUser = await getAccountSession();
      setUser(sessionUser);
    } catch {
      setConfigured(false);
      setFeedbackConfigured(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!configured) return;
    return subscribeAccountAuth(setUser);
  }, [configured]);

  const innerClass = user
    ? "account-page-inner account-page-inner--profile"
    : !configured
      ? "account-page-inner account-page-inner--wide"
      : "account-page-inner";

  return (
    <motion.div
      className={`account-page${user ? " account-page--profile" : ""}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <div className={innerClass}>
        {loading ? (
          <p className="account-page-status muted">Yukleniyor…</p>
        ) : !configured ? (
          <section className="account-panel-card account-panel-card--setup">
            <h2 className="account-panel-title">Hesap</h2>
            <p>
              Supabase URL ve <strong>anon (public) key</strong> bulunamadi. Lisans ve geri bildirimle ayni bilgiler
              kullanilir.
            </p>
            <ol className="account-setup-steps">
              <li>
                Proje kokunde <code>.env.local.example</code> dosyasini <code>.env.local</code> olarak kopyalayin.
              </li>
              <li>
                Icine Supabase panelindeki <strong>Project URL</strong> ve <strong>anon public</strong> anahtarini yazin.
              </li>
              <li>
                Veya <code>build/supabase-license.example.json</code> dosyasini{" "}
                <code>build/supabase-license.json</code> yapip doldurun.
              </li>
              <li>Uygulamayi tamamen kapatip <code>npm run dev</code> ile yeniden acin.</li>
              <li>Supabase → Authentication → Providers → <strong>Email</strong> acik olsun.</li>
            </ol>
            {feedbackConfigured === true ? (
              <p className="account-auth-message account-auth-message--ok">
                Geri bildirim ayarlari algilandi; uygulamayi yeniden baslatmayi deneyin.
              </p>
            ) : null}
          </section>
        ) : user ? (
          <AccountProfilePanel
            user={user}
            feedbackConfigured={feedbackConfigured === true}
            onUserChange={setUser}
            onSignedOut={() => setUser(null)}
            onOpenSettings={onOpenSettings ?? (() => {})}
            onOpenLegal={onOpenLegal ?? (() => {})}
            onCompanySaved={onCompanySaved}
          />
        ) : (
          <div className="account-auth-shell">
            <header className="account-auth-header">
              <h2 className="account-panel-title">Hesap</h2>
              <p className="account-auth-lead">
                Kayitli degilseniz once kayit olun; giris yaptiktan sonra profil ekrani acilir.
              </p>
            </header>
            <section className="account-panel-card account-panel-card--auth" aria-label="Giris ve kayit">
              <AccountAuthPanel onAuthenticated={() => void refresh()} />
            </section>
          </div>
        )}
      </div>
    </motion.div>
  );
}
