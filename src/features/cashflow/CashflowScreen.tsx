import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { getMarinaApi } from "../../api/marinaClient";
import type { CashflowEntry, CashflowMonthlySummary } from "../../types/models";
import { formatTry, parseTrAmount, tlToKurus } from "../../utils/currency";

function kindLabel(kind: CashflowEntry["kind"], row?: CashflowEntry): string {
  if (kind === "extra_income") return "Ek gelir";
  if (kind === "expense_daily") {
    if (row?.stockMovementId != null && row.stockMovementId > 0) return "Urun alimi (stok)";
    return "Gunluk gider";
  }
  return "Aylik gider";
}

export function CashflowScreen() {
  const defaultYm = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [yearMonth, setYearMonth] = useState(defaultYm);
  const [summary, setSummary] = useState<CashflowMonthlySummary | null>(null);
  const [entries, setEntries] = useState<CashflowEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [extraDate, setExtraDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [extraTl, setExtraTl] = useState("");
  const [extraCat, setExtraCat] = useState("");
  const [extraNote, setExtraNote] = useState("");

  const [dailyDate, setDailyDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dailyTl, setDailyTl] = useState("");
  const [dailyCat, setDailyCat] = useState("");
  const [dailyNote, setDailyNote] = useState("");

  const [monthlyYm, setMonthlyYm] = useState(defaultYm);
  const [monthlyTl, setMonthlyTl] = useState("");
  const [monthlyCat, setMonthlyCat] = useState("");
  const [monthlyNote, setMonthlyNote] = useState("");

  const reload = useCallback(async () => {
    setError(null);
    try {
      const api = getMarinaApi();
      const [sum, list] = await Promise.all([
        api.getCashflowMonthlySummary(yearMonth),
        api.listCashflowMonth(yearMonth)
      ]);
      setSummary(sum);
      setEntries(list);
    } catch (e) {
      setSummary(null);
      setEntries([]);
      setError(e instanceof Error ? e.message : "Yukleme hatasi");
    }
  }, [yearMonth]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const submitExtra = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseTrAmount(String(extraTl).trim());
    if (amount == null || amount < 0) {
      setError("Gecerli tutar girin.");
      return;
    }
    const amountKurus = tlToKurus(amount);
    try {
      await getMarinaApi().createCashflowEntry({
        kind: "extra_income",
        entryDate: extraDate,
        amountKurus,
        category: extraCat || "Ek gelir",
        note: extraNote
      });
      setExtraTl("");
      setExtraNote("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayit hatasi");
    }
  };

  const submitDaily = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseTrAmount(String(dailyTl).trim());
    if (amount == null || amount < 0) {
      setError("Gecerli tutar girin.");
      return;
    }
    const amountKurus = tlToKurus(amount);
    try {
      await getMarinaApi().createCashflowEntry({
        kind: "expense_daily",
        entryDate: dailyDate,
        amountKurus,
        category: dailyCat || "Gunluk gider",
        note: dailyNote
      });
      setDailyTl("");
      setDailyNote("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayit hatasi");
    }
  };

  const submitMonthly = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseTrAmount(String(monthlyTl).trim());
    if (amount == null || amount < 0) {
      setError("Gecerli tutar girin.");
      return;
    }
    const amountKurus = tlToKurus(amount);
    try {
      await getMarinaApi().createCashflowEntry({
        kind: "expense_monthly",
        billingMonth: monthlyYm,
        amountKurus,
        category: monthlyCat || "Aylik gider",
        note: monthlyNote
      });
      setMonthlyTl("");
      setMonthlyNote("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayit hatasi");
    }
  };

  const onDelete = async (id: number) => {
    const row = entries.find((e) => e.id === id);
    const msg =
      row?.stockMovementId != null && row.stockMovementId > 0
        ? "Bu kayit stok alimindan otomatik olustu. Silmek stok gecmisini degistirmez. Yine de silinsin mi?"
        : "Bu kaydi silmek istiyor musunuz?";
    if (!window.confirm(msg)) return;
    try {
      await getMarinaApi().deleteCashflowEntry(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silme hatasi");
    }
  };

  return (
    <motion.div className="report-screen cashflow-screen" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h2>Gelir / Gider</h2>
      <p className="closure-help small">
        Secilen ayda POS satislarindan gelen net ciro, ek gelir ve giderler birlikte gosterilir.{" "}
        <strong>Stok → Stok ekle</strong> ve yeni urun kartindaki ilk stokta odenen tutarlar otomatik olarak{" "}
        <strong>Mal alimi / stok</strong> gunluk giderine yazilir (kismi odemede yalnizca odenen kisim). Aylik giderler
        (elektrik, su vb.) secilen aya yazilir.
      </p>

      <div className="cashflow-month-bar">
        <label>
          <span>Ay</span>
          <input type="month" value={yearMonth} onChange={(ev) => setYearMonth(ev.target.value)} />
        </label>
      </div>

      {error ? <p className="cashflow-error">{error}</p> : null}

      {summary ? (
        <div className="report-stats report-stats-big cashflow-summary">
          <div>
            <span>Satis neti (POS, ay)</span>
            <strong>{formatTry(summary.salesNetKurus)}</strong>
          </div>
          <div>
            <span>Ek gelir (manuel)</span>
            <strong className="cashflow-pos">{formatTry(summary.extraIncomeKurus)}</strong>
          </div>
          <div>
            <span>Gunluk gider toplami</span>
            <strong className="cashflow-neg">{formatTry(summary.dailyExpenseKurus)}</strong>
          </div>
          <div>
            <span>Urun alimi / stok (otomatik)</span>
            <strong className="cashflow-neg">{formatTry(summary.stockPurchaseExpenseKurus)}</strong>
          </div>
          <div>
            <span>Diger gunluk gider</span>
            <strong className="cashflow-neg">{formatTry(summary.otherDailyExpenseKurus)}</strong>
          </div>
          <div>
            <span>Aylik gider toplami</span>
            <strong className="cashflow-neg">{formatTry(summary.monthlyExpenseKurus)}</strong>
          </div>
          <div>
            <span>Manuel gider (gunluk + aylik)</span>
            <strong className="cashflow-neg">{formatTry(summary.manualExpenseTotalKurus)}</strong>
          </div>
          <div>
            <span>Toplam gelir (satis + ek)</span>
            <strong>{formatTry(summary.totalInflowKurus)}</strong>
          </div>
          <div>
            <span>Bakiye (gelir - manuel gider)</span>
            <strong className={summary.balanceKurus >= 0 ? "cashflow-pos" : "cashflow-neg"}>
              {formatTry(summary.balanceKurus)}
            </strong>
          </div>
        </div>
      ) : !error ? (
        <p className="report-empty">Ozet yukleniyor...</p>
      ) : null}

      <div className="cashflow-forms">
        <form className="cashflow-form-card" onSubmit={submitExtra}>
          <h3>Ek gelir</h3>
          <label>
            Tarih
            <input type="date" value={extraDate} onChange={(ev) => setExtraDate(ev.target.value)} required />
          </label>
          <label>
            Tutar (TL)
            <input type="text" inputMode="decimal" value={extraTl} onChange={(ev) => setExtraTl(ev.target.value)} placeholder="0,00" required />
          </label>
          <label>
            Kategori
            <input list="cashflow-cat-extra" value={extraCat} onChange={(ev) => setExtraCat(ev.target.value)} placeholder="Orn. Kira iadesi" />
          </label>
          <label>
            Not
            <input value={extraNote} onChange={(ev) => setExtraNote(ev.target.value)} />
          </label>
          <button type="submit">Kaydet</button>
        </form>

        <form className="cashflow-form-card" onSubmit={submitDaily}>
          <h3>Gunluk gider</h3>
          <label>
            Tarih
            <input type="date" value={dailyDate} onChange={(ev) => setDailyDate(ev.target.value)} required />
          </label>
          <label>
            Tutar (TL)
            <input type="text" inputMode="decimal" value={dailyTl} onChange={(ev) => setDailyTl(ev.target.value)} placeholder="0,00" required />
          </label>
          <label>
            Kategori
            <input list="cashflow-cat-daily" value={dailyCat} onChange={(ev) => setDailyCat(ev.target.value)} placeholder="Yeme-icme, malzeme..." />
          </label>
          <label>
            Not
            <input value={dailyNote} onChange={(ev) => setDailyNote(ev.target.value)} />
          </label>
          <button type="submit">Kaydet</button>
        </form>

        <form className="cashflow-form-card" onSubmit={submitMonthly}>
          <h3>Aylik gider</h3>
          <label>
            Ait oldugu ay
            <input type="month" value={monthlyYm} onChange={(ev) => setMonthlyYm(ev.target.value)} required />
          </label>
          <label>
            Tutar (TL)
            <input type="text" inputMode="decimal" value={monthlyTl} onChange={(ev) => setMonthlyTl(ev.target.value)} placeholder="0,00" required />
          </label>
          <label>
            Kategori
            <input list="cashflow-cat-monthly" value={monthlyCat} onChange={(ev) => setMonthlyCat(ev.target.value)} placeholder="Elektrik, su..." />
          </label>
          <label>
            Not
            <input value={monthlyNote} onChange={(ev) => setMonthlyNote(ev.target.value)} />
          </label>
          <button type="submit">Kaydet</button>
        </form>
      </div>

      <datalist id="cashflow-cat-extra">
        <option value="Beklenmeyen gelir" />
        <option value="Kira / depozito iadesi" />
        <option value="Diger" />
      </datalist>
      <datalist id="cashflow-cat-daily">
        <option value="Mal alimi / stok" />
        <option value="Yeme-icme" />
        <option value="Malzeme" />
        <option value="Temizlik" />
        <option value="Kurye / tasima" />
      </datalist>
      <datalist id="cashflow-cat-monthly">
        <option value="Elektrik" />
        <option value="Su" />
        <option value="Dogalgaz" />
        <option value="Internet" />
        <option value="Kira" />
      </datalist>

      <section className="cashflow-table-section">
        <h3>Bu ay tum kayitlar</h3>
        {entries.length === 0 ? (
          <p className="report-empty">Kayit yok.</p>
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
                  <th />
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => (
                  <tr key={row.id}>
                    <td>{kindLabel(row.kind, row)}</td>
                    <td>
                      {row.kind === "expense_monthly" ? row.billingMonth : row.entryDate}
                    </td>
                    <td>{row.category}</td>
                    <td>{formatTry(row.amountKurus)}</td>
                    <td className="cashflow-note-cell">{row.note || "—"}</td>
                    <td>
                      {row.stockMovementId != null && row.stockMovementId > 0 ? (
                        <span className="cashflow-auto-tag" title="Stok alimindan otomatik">
                          Stok
                        </span>
                      ) : (
                        <button type="button" className="cashflow-del" onClick={() => void onDelete(row.id)}>
                          Sil
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </motion.div>
  );
}
