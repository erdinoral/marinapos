import { useEffect, useMemo, useState } from "react";
import type { Settings } from "../../types/models";

function localYmd(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isLastDayOfMonth(ymd: string): boolean {
  const parts = ymd.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return false;
  const [y, m, day] = parts;
  const last = new Date(y, m, 0).getDate();
  return day === last;
}

function minutesFromMidnight(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

function parseClosureMinutes(s: string): number {
  const [a, b] = s.split(":").map((x) => Number(String(x).trim()));
  const hh = Number.isFinite(a) ? a : 23;
  const mm = Number.isFinite(b) ? b : 0;
  return hh * 60 + mm;
}

interface Props {
  settings: Settings;
  onGoMonthEnd: () => void;
  /** Rapor sekmesi acikken dakika tiklari */
  active: boolean;
}

export function ReportMonthEndBanner({ settings, onGoMonthEnd, active }: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 60000);
    return () => window.clearInterval(id);
  }, [active]);

  const banner = useMemo(() => {
    if (!active) return { show: false as const };
    const ymd = localYmd();
    if (!isLastDayOfMonth(ymd)) return { show: false as const };
    const closMin = parseClosureMinutes(settings.closureTime);
    const nowMin = minutesFromMidnight(new Date());
    const delta = closMin - nowMin;
    const urgent = delta <= 120 && delta >= -240;
    const message = urgent
      ? "Kapanisa yaklastiniz — bu gece ay sonu. Asagidaki raporda tum hareketleri son kez gozden gecirin."
      : "Bugun ayin son gunu. Ay sonu raporu hazir; satis, kapanis ve gelir-gider ozeti tek ekranda.";
    const sub = `Planlanan kapanis saati: ${settings.closureTime}`;
    return { show: true as const, urgent, message, sub };
  }, [active, settings.closureTime, tick]);

  if (!banner.show) return null;

  return (
    <div className={`report-monthend-banner ${banner.urgent ? "report-monthend-banner--urgent" : ""}`}>
      <div className="report-monthend-banner-text">
        <strong>Ay sonu</strong>
        <p>{banner.message}</p>
        <small>{banner.sub}</small>
      </div>
      <button type="button" className="report-monthend-banner-btn" onClick={onGoMonthEnd}>
        Ay sonu raporunu ac
      </button>
    </div>
  );
}
