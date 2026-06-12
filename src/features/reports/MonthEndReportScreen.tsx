import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { getMarinaApi } from "../../api/marinaClient";
import type { CashflowEntry, MonthEndReport } from "../../types/models";
import { formatTlTable, formatTry } from "../../utils/currency";

function localYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function cashflowKindLabel(kind: CashflowEntry["kind"]): string {
  if (kind === "extra_income") return "Ek gelir";
  if (kind === "expense_daily") return "Gunluk gider";
  return "Aylik gider";
}

export function MonthEndReportScreen() {
  const defaultYm = useMemo(() => localYearMonth(), []);
  const [yearMonth, setYearMonth] = useState(defaultYm);
  const [data, setData] = useState<MonthEndReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const row = await getMarinaApi().getMonthEndReport(yearMonth);
      setData(row);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Rapor yuklenemedi");
    }
  }, [yearMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const cf = data?.cashflow;

  return (
    <motion.div className="report-screen month-end-screen" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h2>Ay sonu raporu</h2>
      <p className="closure-help small">
        Secilen ay icin POS satislari (satir + ek ucretler), gunluk kapanis kayitlari, sepet dagilimi, en cok satilanlar ve
        manuel gelir/gider kalemleri bir arada sunulur. Kapanistan once bu ozeti kontrol edin.
      </p>

      <div className="cashflow-month-bar">
        <label>
          <span>Rapor ayi</span>
          <input type="month" value={yearMonth} onChange={(ev) => setYearMonth(ev.target.value)} />
        </label>
      </div>

      {error ? <p className="cashflow-error">{error}</p> : null}

      {data && cf ? (
        <>
          <div className="report-stats report-stats-big month-end-summary">
            <div>
              <span>Satis kaydi (POS)</span>
              <strong>{data.salesCount}</strong>
            </div>
            <div>
              <span>Stok hareketi (ay)</span>
              <strong>{data.stockMovementsCount}</strong>
            </div>
            <div>
              <span>Kapanis gunu (kayit)</span>
              <strong>{data.closures.length}</strong>
            </div>
            <div>
              <span>Ciro (satir + ek)</span>
              <strong>{formatTry(data.revenueKurus)}</strong>
            </div>
            <div>
              <span>Maliyet</span>
              <strong>{formatTry(data.costKurus)}</strong>
            </div>
            <div>
              <span>Brut kar</span>
              <strong>{formatTry(data.profitKurus)}</strong>
            </div>
            <div>
              <span>Nakit (subtotal)</span>
              <strong>{formatTry(data.cashKurus)}</strong>
            </div>
            <div>
              <span>Kart (subtotal)</span>
              <strong>{formatTry(data.cardKurus)}</strong>
            </div>
            <div>
              <span>Ek gelir (manuel)</span>
              <strong className="cashflow-pos">{formatTry(cf.extraIncomeKurus)}</strong>
            </div>
            <div>
              <span>Manuel gider (gunluk + aylik)</span>
              <strong className="cashflow-neg">{formatTry(cf.manualExpenseTotalKurus)}</strong>
            </div>
            <div>
              <span>Gelir-Gider bakiye</span>
              <strong className={cf.balanceKurus >= 0 ? "cashflow-pos" : "cashflow-neg"}>{formatTry(cf.balanceKurus)}</strong>
            </div>
          </div>

          <div className="month-end-detail-toggle">
            <button type="button" className="month-end-detail-btn" onClick={() => setDetailOpen((v) => !v)}>
              {detailOpen ? "− Detayi gizle" : "+ Detay"}
            </button>
          </div>

          {detailOpen ? (
            <div className="month-end-detail-panels">
              <section className="month-end-detail-block">
                <h3>Gunluk kapanis (ay icindeki gunler)</h3>
                {data.monthlyDayTotals.length === 0 ? (
                  <p className="report-empty">Bu ay icin kapanis kaydi yok (henuz kapanis alinmamis olabilir).</p>
                ) : (
                  <div className="cashflow-table-wrap">
                    <table className="cashflow-table">
                      <thead>
                        <tr>
                          <th>Tarih</th>
                          <th>Satis</th>
                          <th>Ciro</th>
                          <th>Maliyet</th>
                          <th>Kar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.monthlyDayTotals.map((r) => (
                          <tr key={r.tarih}>
                            <td>{r.tarih}</td>
                            <td>{r.satisAdedi}</td>
                            <td>{formatTlTable(r.ciroTl)}</td>
                            <td>{formatTlTable(r.maliyetTl)}</td>
                            <td>{formatTlTable(r.karTl)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="month-end-detail-block">
                <h3>Kapanis kayitlari (kurus)</h3>
                {data.closures.length === 0 ? (
                  <p className="report-empty">Kapanis satiri yok.</p>
                ) : (
                  <div className="cashflow-table-wrap">
                    <table className="cashflow-table">
                      <thead>
                        <tr>
                          <th>Tarih</th>
                          <th>Satis</th>
                          <th>Ciro</th>
                          <th>Kar</th>
                          <th>Nakit</th>
                          <th>Kart</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.closures.map((c) => (
                          <tr key={c.closureDate}>
                            <td>{c.closureDate}</td>
                            <td>{c.totalSalesCount}</td>
                            <td>{formatTry(c.grossRevenueKurus)}</td>
                            <td>{formatTry(c.profitKurus)}</td>
                            <td>{formatTry(c.cashTotalKurus)}</td>
                            <td>{formatTry(c.cardTotalKurus)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="month-end-detail-block">
                <h3>Sepet bazli satis (ay)</h3>
                {data.cartSummaries.length === 0 ? (
                  <p className="report-empty">Sepet kaydi yok.</p>
                ) : (
                  <div className="report-top-list report-top-list-big">
                    {data.cartSummaries.map((row) => (
                      <div key={row.cartName} className="report-top-row">
                        <span>{row.cartName}</span>
                        <small>{row.salesCount} satis</small>
                        <small>Ortalama: {formatTry(row.avgSaleKurus)}</small>
                        <strong>Toplam: {formatTry(row.totalKurus)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="month-end-detail-block">
                <h3>En cok satilanlar (ay)</h3>
                {data.topSelling.length === 0 ? (
                  <p className="report-empty">Satir yok.</p>
                ) : (
                  <div className="report-top-list report-top-list-big">
                    {data.topSelling.map((p, idx) => (
                      <div key={p.productId} className="report-top-row">
                        <span>
                          {idx + 1}. {p.productName}
                        </span>
                        <small>{p.productCode || "-"}</small>
                        <strong>{p.qty.toFixed(2)} — {formatTry(p.revenueKurus)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="month-end-detail-block">
                <h3>Manuel gelir ve giderler</h3>
                {data.cashflowEntries.length === 0 ? (
                  <p className="report-empty">Manuel kayit yok.</p>
                ) : (
                  <div className="cashflow-table-wrap">
                    <table className="cashflow-table">
                      <thead>
                        <tr>
                          <th>Tur</th>
                          <th>Tarih / ay</th>
                          <th>Kategori</th>
                          <th>Tutar</th>
                          <th>Not</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.cashflowEntries.map((row) => (
                          <tr key={row.id}>
                            <td>{cashflowKindLabel(row.kind)}</td>
                            <td>{row.kind === "expense_monthly" ? row.billingMonth : row.entryDate}</td>
                            <td>{row.category}</td>
                            <td>{formatTry(row.amountKurus)}</td>
                            <td className="cashflow-note-cell">{row.note || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </>
      ) : !error ? (
        <p className="report-empty">Yukleniyor...</p>
      ) : null}
    </motion.div>
  );
}
