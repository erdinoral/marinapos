import { useCallback, useEffect, useState } from "react";
import {
  FX_CACHE_TTL_MS,
  formatFxTry,
  getFxCacheAgeMs,
  getFxRates,
  type FxRatesSnapshot
} from "../../services/fxRates";

function ageLabel(ageMs: number | null): string {
  if (ageMs == null) return "";
  const min = Math.floor(ageMs / 60_000);
  if (min < 1) return "az once";
  if (min < 60) return `${min} dk once`;
  const h = Math.floor(min / 60);
  return `${h} sa once`;
}

export function FxRatesFooter() {
  const [snap, setSnap] = useState<FxRatesSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ageMs, setAgeMs] = useState<number | null>(null);

  const load = useCallback(async (force = false) => {
    setBusy(true);
    setError("");
    try {
      const next = await getFxRates({ force });
      setSnap(next);
      setAgeMs(getFxCacheAgeMs());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kur alinamadi");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
    const tick = window.setInterval(() => {
      setAgeMs(getFxCacheAgeMs());
      void load(false);
    }, Math.min(FX_CACHE_TTL_MS, 30 * 60 * 1000));
    return () => window.clearInterval(tick);
  }, [load]);

  const title = snap
    ? `Kaynak: ${snap.source}\nGuncelleme: ${ageLabel(ageMs) || "—"}\nTiklayinca yeniler (en fazla 5 dk'da bir; API 4 saatte bir cekilir)`
    : "Dolar / Euro kuru (ucretsiz API, 4 saatte bir)";

  return (
    <button
      type="button"
      className={`footer-fx${busy ? " footer-fx--busy" : ""}${error && !snap ? " footer-fx--err" : ""}`}
      title={title}
      onClick={() => void load(true)}
      disabled={busy}
    >
      {snap ? (
        <>
          <span className="footer-fx-pair">
            <abbr title="ABD Dolari">USD</abbr> {formatFxTry(snap.usdTry)}
          </span>
          {snap.eurTry != null ? (
            <span className="footer-fx-pair">
              <abbr title="Euro">EUR</abbr> {formatFxTry(snap.eurTry)}
            </span>
          ) : null}
        </>
      ) : error ? (
        <span className="footer-fx-pair">Kur —</span>
      ) : (
        <span className="footer-fx-pair">Kur…</span>
      )}
    </button>
  );
}
