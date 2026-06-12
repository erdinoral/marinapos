import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { getMarinaApi } from "../../api/marinaClient";
import { MonthlyDayTotal } from "../../types/models";
import { formatTlTable } from "../../utils/currency";

const MONTH_LABELS_TR = [
  "Ocak",
  "Subat",
  "Mart",
  "Nisan",
  "Mayis",
  "Haziran",
  "Temmuz",
  "Agustos",
  "Eylul",
  "Ekim",
  "Kasim",
  "Aralik"
];

/** Bitiş ayı dahil, geriye doğru 12 ay (YYYY-MM) */
function last12MonthsEndingAt(year: number, month1to12: number): string[] {
  const monthIndex0 = month1to12 - 1;
  const out: string[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(year, monthIndex0 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

function yearOptions(): number[] {
  const y = new Date().getFullYear();
  const min = y - 20;
  const list: number[] = [];
  for (let yy = y + 1; yy >= min; yy -= 1) list.push(yy);
  return list;
}

export function TableScreen() {
  const now = useMemo(() => new Date(), []);
  const [endYear, setEndYear] = useState(() => now.getFullYear());
  const [endMonth, setEndMonth] = useState(() => now.getMonth() + 1);

  const monthsWindow = useMemo(() => last12MonthsEndingAt(endYear, endMonth), [endYear, endMonth]);

  const endKey = useMemo(
    () => `${endYear}-${String(endMonth).padStart(2, "0")}`,
    [endYear, endMonth]
  );

  const [selectedMonth, setSelectedMonth] = useState(endKey);
  const [monthRowsByMonth, setMonthRowsByMonth] = useState<Record<string, MonthlyDayTotal[]>>({});

  useEffect(() => {
    setSelectedMonth(endKey);
  }, [endKey]);

  const loadMonthTables = useCallback(async (months: string[]) => {
    try {
      const api = getMarinaApi();
      const rows = await Promise.all(months.map((ym) => api.getMonthlyDayTotals(ym)));
      const map: Record<string, MonthlyDayTotal[]> = {};
      for (let i = 0; i < months.length; i += 1) {
        map[months[i]] = rows[i] ?? [];
      }
      setMonthRowsByMonth(map);
    } catch {
      setMonthRowsByMonth({});
    }
  }, []);

  useEffect(() => {
    void loadMonthTables(monthsWindow);
  }, [monthsWindow, loadMonthTables]);

  const monthlySummaries = useMemo(() => {
    return monthsWindow.map((ym) => {
      const rows = monthRowsByMonth[ym] ?? [];
      const satisAdedi = rows.reduce((sum, r) => sum + r.satisAdedi, 0);
      const ciroTl = rows.reduce((sum, r) => sum + r.ciroTl, 0);
      const maliyetTl = rows.reduce((sum, r) => sum + r.maliyetTl, 0);
      return { ym, satisAdedi, ciroTl, maliyetTl, karTl: ciroTl - maliyetTl };
    });
  }, [monthsWindow, monthRowsByMonth]);

  const selectedRows = monthRowsByMonth[selectedMonth] ?? [];
  const selectedMonthTotal = useMemo(() => {
    const satisAdedi = selectedRows.reduce((sum, r) => sum + r.satisAdedi, 0);
    const ciroTl = selectedRows.reduce((sum, r) => sum + r.ciroTl, 0);
    const maliyetTl = selectedRows.reduce((sum, r) => sum + r.maliyetTl, 0);
    return { satisAdedi, ciroTl, maliyetTl, karTl: ciroTl - maliyetTl };
  }, [selectedRows]);

  const generatedAt = new Date().toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });

  const rangeLabel = `${monthsWindow[0] ?? ""} — ${monthsWindow[monthsWindow.length - 1] ?? ""}`;

  const monthCardLabel = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    const name = MONTH_LABELS_TR[(m ?? 1) - 1] ?? ym;
    return `${name} ${y}`;
  };

  return (
    <motion.div className="table-screen" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <div className="table-screen-head">
        <h2>Tablo Raporu (Son 12 Ay)</h2>
        <button type="button" className="table-print-btn screen-only" onClick={() => window.print()}>
          Yazdir
        </button>
      </div>
      <p className="closure-help small">
        Kapanisi alinmis gunler tabloya otomatik yansir. Asagidan bitis yili ve ayini secerek son 12 ayin penceresini
        degistirebilirsiniz; kartlardan ay secince gun gun dagilim gorunur.
      </p>

      <div className="table-screen-picker screen-only">
        <label className="table-picker-field">
          <span>Bitis yili</span>
          <select value={endYear} onChange={(e) => setEndYear(Number(e.target.value))}>
            {yearOptions().map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="table-picker-field">
          <span>Bitis ayi</span>
          <select value={endMonth} onChange={(e) => setEndMonth(Number(e.target.value))}>
            {MONTH_LABELS_TR.map((label, idx) => (
              <option key={label} value={idx + 1}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p className="table-picker-range">
          <strong>12 aylik aralik:</strong> {rangeLabel}
        </p>
      </div>

      <div className="table-print-meta">
        <span>Secili ay (detay): {selectedMonth}</span>
        <span>12 ay araligi: {rangeLabel}</span>
        <span>Rapor olusturma: {generatedAt}</span>
      </div>

      <div className="table-month-cards screen-only">
        {monthlySummaries.map((m) => (
          <button
            key={m.ym}
            type="button"
            className={selectedMonth === m.ym ? "active" : ""}
            onClick={() => setSelectedMonth(m.ym)}
          >
            <span>{monthCardLabel(m.ym)}</span>
            <strong>{formatTlTable(m.ciroTl)}</strong>
            <small>Kar: {formatTlTable(m.karTl)}</small>
            <small>Satis: {m.satisAdedi}</small>
          </button>
        ))}
      </div>

      <div className="closure-lines-wrap table-screen-wrap">
        <table className="closure-lines-table table-screen-table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Satis adedi</th>
              <th>Ciro</th>
              <th>Maliyet</th>
              <th>Kar</th>
            </tr>
          </thead>
          <tbody>
            {selectedRows.map((row) => (
              <tr key={row.tarih}>
                <td>{row.tarih}</td>
                <td>{row.satisAdedi}</td>
                <td>{formatTlTable(row.ciroTl)}</td>
                <td>{formatTlTable(row.maliyetTl)}</td>
                <td className="sales-amount">{formatTlTable(row.karTl)}</td>
              </tr>
            ))}
            <tr className="closure-month-total-row">
              <td>{selectedMonth} toplam</td>
              <td>{selectedMonthTotal.satisAdedi}</td>
              <td>{formatTlTable(selectedMonthTotal.ciroTl)}</td>
              <td>{formatTlTable(selectedMonthTotal.maliyetTl)}</td>
              <td className="sales-amount">{formatTlTable(selectedMonthTotal.karTl)}</td>
            </tr>
            {selectedRows.length === 0 && (
              <tr>
                <td>{selectedMonth}</td>
                <td colSpan={4}>Bu ayda kapanis alinmis kayit yok.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
