import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { getMarinaApi } from "../../api/marinaClient";
import { ClosureRunResult, DayProfitDetail, SaleRecord, Settings } from "../../types/models";
import { formatTry } from "../../utils/currency";
import { saleCollectedKurus } from "../../utils/saleCollected";
import { formatQtyShort } from "../../utils/saleUnit";

interface Props {
  settings: Settings;
}

export function ClosureScreen({ settings }: Props) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [last, setLast] = useState<ClosureRunResult | null>(null);
  const [dayProfit, setDayProfit] = useState<DayProfitDetail | null>(null);
  const [todaySales, setTodaySales] = useState<SaleRecord[]>([]);

  const loadTodayData = useCallback(async () => {
    try {
      const api = getMarinaApi();
      const [profit, sales] = await Promise.all([api.getDayProfitDetail(today), api.getDailySales(today)]);
      setDayProfit(profit);
      setTodaySales(sales);
    } catch {
      setDayProfit(null);
      setTodaySales([]);
    }
  }, [today]);

  useEffect(() => {
    void loadTodayData();
  }, [loadTodayData]);

  const paymentBreakdown = useMemo(() => {
    let cash = 0;
    let card = 0;
    for (const s of todaySales) {
      const collected = saleCollectedKurus(s);
      if (s.paymentType === "cash") cash += collected;
      else card += collected;
    }
    return { cash, card, total: cash + card };
  }, [todaySales]);

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getMarinaApi().runClosure();
      setLast(result);
      await loadTodayData();
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

  return (
    <motion.div
      className="closure-panel closure-panel-wide"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <h2>Kapanış</h2>
      <p className="closure-help">
        Gunluk kapanista ciro, <strong>gelis maliyeti</strong> ve <strong>kar</strong> hesaplanir;{" "}
        <code>reports/kapanis-AAAA-GG-GG.txt</code> dosyasina satir satir yazilir. Her gun icin ayrica{" "}
        <code>reports/kar-not-AAAA-AA.txt</code> dosyasina tek satir eklenir (aylik gunluk not).
        Ayni gun yanlislikla erken kapanis alindiysa, tekrar &quot;Bugunun kapanisini al&quot; dediginizde kayit{" "}
        <strong>bugunun satislariyla guncellenir</strong>; ertesi gune tasimaz. O gun icin hic kapanis yoksa kapanis
        saatinde (uygulama acikken) bir kez otomatik alinir; gun zaten kapanmissa otomatik tekrarlanmaz, guncelleme
        icin bu dugmeyi kullanin. Nakit ve kart tutarlari bugunun satis kayitlarindan otomatik alinir; fiziki kasa
        sayimi girilmez.
      </p>
      <p className="closure-meta">
        Planlanan otomatik kapanis saati: <strong>{settings.closureTime}</strong>
      </p>
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
                    <th>Miktar</th>
                    <th>Gelis</th>
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
                      <td>{formatQtyShort(r.qty, r.saleUnit)}</td>
                      <td>
                        {r.saleUnit === "gram"
                          ? `${formatTry(r.unitCostKurus)} / 1000 g`
                          : formatTry(r.unitCostKurus)}
                      </td>
                      <td>{r.saleUnit === "gram" ? `${formatTry(r.unitPriceKurus)} / 1000 g` : formatTry(r.unitPriceKurus)}</td>
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
        <div className="closure-close-payments">
          <h3>Bugunun odeme ozeti (otomatik)</h3>
          <p className="closure-help small">
            Asagidaki tutarlar kayitli satislardan hesaplanir; kapanista el ile sayim girilmez.
          </p>
          <div className="closure-today-stats">
            <div>
              <span>Nakit</span>
              <span className="sales-amount">{formatTry(paymentBreakdown.cash)}</span>
            </div>
            <div>
              <span>Kart</span>
              <span className="sales-amount">{formatTry(paymentBreakdown.card)}</span>
            </div>
            <div>
              <span>Toplam</span>
              <span className="sales-amount">{formatTry(paymentBreakdown.total)}</span>
            </div>
          </div>
        </div>
        <button type="button" className="closure-primary" disabled={loading} onClick={() => void run()}>
          {loading ? "Isleniyor..." : "Bugunun kapanisini al"}
        </button>
      </div>

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
            <li>
              Gercek sayilan kasa:{" "}
              {last.actualCashKurus == null ? "— (sayim girilmedi)" : formatTry(last.actualCashKurus)}
            </li>
            <li>
              Kasa farki:{" "}
              <span className="sales-amount">
                {last.cashDiffKurus == null ? "— (sayim yok)" : formatTry(last.cashDiffKurus)}
              </span>
            </li>
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
