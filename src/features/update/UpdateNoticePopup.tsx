import { useEffect, useRef, useState } from "react";
import { getMarinaApi } from "../../api/marinaClient";
import {
  APP_RELEASE_DATE,
  APP_RELEASE_NOTES,
  APP_VERSION
} from "../account/accountReleaseNotes";

const AUTO_CLOSE_MS = 10_000;
const HIGHLIGHT_COUNT = 4;
const SEEN_KEY = "marina-update-notice-seen-version";

/** Bu surum icin pop-up daha once gosterildi mi? */
export function shouldShowUpdateNotice(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== APP_VERSION;
  } catch {
    return true;
  }
}

export function markUpdateNoticeSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, APP_VERSION);
  } catch {
    /* */
  }
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export function UpdateNoticePopup({ open, onClose }: Props) {
  const [remoteHint, setRemoteHint] = useState("");
  const [progress, setProgress] = useState(100);
  const closedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const highlights = APP_RELEASE_NOTES.slice(0, HIGHLIGHT_COUNT);

  useEffect(() => {
    if (!open) return;
    closedRef.current = false;
    setProgress(100);
    setRemoteHint("");

    const finish = () => {
      if (closedRef.current) return;
      closedRef.current = true;
      markUpdateNoticeSeen();
      onCloseRef.current();
    };

    void (async () => {
      try {
        const api = getMarinaApi();
        if (typeof api.checkForAppUpdate !== "function") return;
        const info = await api.checkForAppUpdate();
        if (closedRef.current) return;
        if (info.phase === "available" && info.latestVersion) {
          setRemoteHint(`Yeni surum hazir: ${info.latestVersion}. Ayarlar → Guncelleme ile indirebilirsiniz.`);
        } else if (info.phase === "downloaded" && info.latestVersion) {
          setRemoteHint(`Surum ${info.latestVersion} indirildi. Kurmak icin uygulamayi yeniden baslatin.`);
        }
      } catch {
        /* sessiz */
      }
    })();

    const started = performance.now();
    const tick = window.setInterval(() => {
      const elapsed = performance.now() - started;
      const left = Math.max(0, 100 - (elapsed / AUTO_CLOSE_MS) * 100);
      setProgress(left);
      if (elapsed >= AUTO_CLOSE_MS) {
        window.clearInterval(tick);
        finish();
      }
    }, 50);

    return () => window.clearInterval(tick);
  }, [open]);

  if (!open) return null;

  const handleClose = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    markUpdateNoticeSeen();
    onClose();
  };

  return (
    <div className="update-notice-backdrop" role="presentation" onClick={handleClose}>
      <div
        className="update-notice-dialog"
        role="dialog"
        aria-labelledby="update-notice-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="update-notice-head">
          <div>
            <p className="update-notice-eyebrow">Guncelleme</p>
            <h2 id="update-notice-title">Surum {APP_VERSION}</h2>
            <p className="update-notice-date">{APP_RELEASE_DATE}</p>
          </div>
          <button type="button" className="update-notice-close" onClick={handleClose} aria-label="Kapat">
            ×
          </button>
        </div>

        {remoteHint ? <p className="update-notice-remote">{remoteHint}</p> : null}

        <ul className="update-notice-list">
          {highlights.map((item) => (
            <li key={item.title}>
              <strong>{item.title}</strong>
              <span>{item.body}</span>
            </li>
          ))}
        </ul>

        <div className="update-notice-footer">
          <button type="button" className="update-notice-ok" onClick={handleClose}>
            Tamam
          </button>
          <p className="update-notice-auto">Birazdan otomatik kapanir</p>
        </div>

        <div className="update-notice-progress" aria-hidden>
          <div className="update-notice-progress-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
