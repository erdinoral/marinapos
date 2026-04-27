import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { getMarinaApi } from "../../api/marinaClient";
import { ClosureRunResult, DayProfitDetail, Settings } from "../../types/models";
import { formatTry, tlToKurus } from "../../utils/currency";

interface Props {
  settings: Settings;
}

export function ClosureScreen({ settings }: Props) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [exportMsg, setExportMsg] = useState("");
  const [last, setLast] = useState<ClosureRunResult | null>(null);
  const [dayProfit, setDayProfit] = useState<DayProfitDetail | null>(null);
  const [openingCashTl, setOpeningCashTl] = useState(() => (settings.openingCashKurus / 100).toFixed(2));
  const [actualCashTl, setActualCashTl] = useState("");

  const loadTodayProfit = useCallback(async () => {
    try {
      const d = await getMarinaApi().getDayProfitDetail(today);
      setDayProfit(d);
    } catch {
      setDayProfit(null);
    }
  }, [today]);

  useEffect(() => {
    void loadTodayProfit();
  }, [loadTodayProfit]);

  useEffect(() => {
    setOpeningCashTl((settings.openingCashKurus / 100).toFixed(2));
  }, [settings.openingCashKurus]);

  const saveOpeningCash = async () => {
    const amount = Number(openingCashTl || 0);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Acilis kasasi 0 veya pozitif olmali.");
      return;
    }
    setError("");
    await getMarinaApi().setOpeningCash(tlToKurus(amount));
    setExportMsg("Acilis kasasi kaydedildi.");
  };

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      let actualCashValue: number | undefined;
      if (actualCashTl.trim() !== "") {
        const parsed = Number(actualCashTl);
        if (!Number.isFinite(parsed) || parsed < 0) {
          throw new Error("Gercek kasa tutari gecersiz.");
        }
        actualCashValue = tlToKurus(parsed);
      }
      const result = await getMarinaApi().runClosure(actualCashValue);
      setLast(result);
      setActualCashTl("");
      await loadTodayProfit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kapanis alinamadi.");
    } finally {
      setLoading(false);
    }
  };

  const openFolder = async () => {
    if (!last?.reportPath) return;
    try {
      await getMarinaApi().showItemInFolder(last.reportPath);
    } catch {
      void navigator.clipboard?.writeText(last.reportPath);
      setError("Klasor acilamadi; yol panoya kopyalandi.");
    }
  };

  const exportMonth = async () => {
    setExporting(true);
    setExportMsg("");
    setError("");
    try {
      const filePath = await getMarinaApi().exportMonthlyProfitXlsx(month);
      setExportMsg(`Excel kaydedildi: ${filePath}`);
      await getMarinaApi().showItemInFolder(filePath);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Excel olusturulamadi.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.div
      className="closure-panel closure-panel-wide"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <h2>Kapanis</h2>
      <p className="closure-help">
        Gunluk kapanista ciro, <strong>gelis maliyeti</strong> ve <strong>kar</strong> hesaplanir;{" "}
        <code>reports/kapanis-AAAA-GG-GG.txt</code> dosyasina satir satir yazilir. Her gun icin ayrica{" "}
        <code>reports/kar-not-AAAA-AA.txt</code> dosyasina tek satir eklenir (aylik gunluk not).
        Kapanis saati geldiginde (uygulama acikken) otomatik tekrarlanir.
      </p>
      <p className="closure-meta">
        Planlanan otomatik kapanis saati: <strong>{settings.closureTime}</strong>
      </p>
      <section className="closure-month-export">
        <h3>Kasa acilis</h3>
        <p className="closure-help small">Acilis kasasi 0 olabilir. Bu tutar bugun icin beklenen nakit hesaplamasina dahil edilir.</p>
        <div className="closure-month-row">
          <input
            type="number"
            min={0}
            step="0.01"
            value={openingCashTl}
            onChange={(e) => setOpeningCashTl(e.target.value)}
            placeholder="Acilis kasasi (TL)"
          />
          <button type="button" onClick={() => void saveOpeningCash()}>Acilis Kasasini Kaydet</button>
        </div>
      </section>

      {dayProfit && (
        <section className="closure-today-block">
          <h3>Bugunun ozeti ({today})</h3>
          <div className="closure-today-stats">
            <div>
              <span>Ciro</span>
              <span className="sales-amount">{formatTry(dayProfit.revenueKurus)}</span>
            </div>
            <div>
              <span>Maliyet (gelis)</span>
              <span>{formatTry(dayProfit.costTotalKurus)}</span>
            </div>
            <div>
              <span>Brut kar</span>
              <span className="sales-amount">{formatTry(dayProfit.profitKurus)}</span>
            </div>
            <div>
              <span>Satis satiri</span>
              <span>{dayProfit.lines.length}</span>
            </div>
          </div>
          {dayProfit.lines.length > 0 && (
            <div className="closure-lines-wrap">
              <table className="closure-lines-table">
                <thead>
                  <tr>
                    <th>Saat</th>
                    <th>Urun</th>
                    <th>Adet</th>
                    <th>Gelis (birim)</th>
                    <th>Satis (birim)</th>
                    <th>Maliyet</th>
                    <th>Ciro</th>
                    <th>Kar</th>
                  </tr>
                </thead>
                <tbody>
                  {dayProfit.lines.map((r) => (
                    <tr key={r.saleItemId}>
                      <td>{r.saleCreatedAt.slice(11, 19)}</td>
                      <td>
                        <span className="closure-code">{r.productCode}</span> {r.productName}
                      </td>
                      <td>{r.qty}</td>
                      <td>{formatTry(r.unitCostKurus)}</td>
                      <td>{formatTry(r.unitPriceKurus)}</td>
                      <td>{formatTry(r.lineCostKurus)}</td>
                      <td>{formatTry(r.lineTotalKurus)}</td>
                      <td className="sales-amount">{formatTry(r.lineProfitKurus)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <div className="closure-actions-row">
        <div className="closure-month-row">
          <input
            type="number"
            min={0}
            step="0.01"
            value={actualCashTl}
            onChange={(e) => setActualCashTl(e.target.value)}
            placeholder="Kapanista sayilan gercek kasa (TL, opsiyonel)"
          />
        </div>
        <button type="button" className="closure-primary" disabled={loading} onClick={() => void run()}>
          {loading ? "Isleniyor..." : "Bugunun kapanisini al"}
        </button>
      </div>

      <section className="closure-month-export">
        <h3>Aylik Excel (satis + gelis + kar)</h3>
        <p className="closure-help small">
          Secilen ay icin tum satis satirlari ve gunluk ozet iki sayfada: <strong>SatisSatirlari</strong>,{" "}
          <strong>GunlukOzet</strong>. Dosya Belgeler / MarinaNargileRaporlar altina kaydolur.
        </p>
        <div className="closure-month-row">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          <button type="button" disabled={exporting} onClick={() => void exportMonth()}>
            {exporting ? "Olusturuluyor..." : "Excel indir"}
          </button>
        </div>
        {exportMsg && <p className="form-message">{exportMsg}</p>}
      </section>

      {error && <p className="form-message">{error}</p>}
      {last && (
        <div className="closure-result">
          <h3>Son kapanis kaydi</h3>
          <ul>
            <li>Tarih: {last.date}</li>
            <li>Satis adedi: {last.totalSalesCount}</li>
            <li>Nakit: {formatTry(last.cashTotalKurus)}</li>
            <li>Kasa acilis: {formatTry(last.openingCashKurus)}</li>
            <li>Beklenen kasa: {formatTry(last.expectedCashKurus)}</li>
            <li>Gercek sayilan kasa: {last.actualCashKurus == null ? "-" : formatTry(last.actualCashKurus)}</li>
            <li>Kasa farki: <span className="sales-amount">{last.cashDiffKurus == null ? "-" : formatTry(last.cashDiffKurus)}</span></li>
            <li>Kart: {formatTry(last.cardTotalKurus)}</li>
            <li>Ciro: {formatTry(last.grossRevenueKurus)}</li>
            <li>Maliyet: {formatTry(last.costTotalKurus)}</li>
            <li>Kar: <span className="sales-amount">{formatTry(last.profitKurus)}</span></li>
            <li>Satis satiri: {last.saleLineCount}</li>
          </ul>
          <p className="closure-path">{last.reportPath}</p>
          <button type="button" onClick={() => void openFolder()}>
            Raporu klasorde goster
          </button>
        </div>
      )}
    </motion.div>
  );
}
