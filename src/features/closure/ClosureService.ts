import fs from "node:fs";
import path from "node:path";
import { DatabaseService } from "../../db/databaseService";
import { ClosureRunResult } from "../../types/models";
import { formatTry } from "../../utils/currency";
import { formatQtyShort } from "../../utils/saleUnit";

export class ClosureService {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private database: DatabaseService,
    private onAutoClosureCompleted?: (result: ClosureRunResult) => void
  ) {}

  startScheduler() {
    this.scheduleNextRun();
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  runClosureForToday(actualCashKurus?: number): ClosureRunResult {
    return this.runClosureForDate(this.todayIso(), actualCashKurus, { source: "manual" });
  }

  /**
   * Bugunden once, en az bir satisi olan ama kapanisi kaydedilmemis gunleri kronolojik kapatir.
   * Uygulama acilisinda (tarih degismis, onceki gun unutulmus) cagrilmalidir.
   */
  catchUpMissingClosuresBeforeToday(): ClosureRunResult[] {
    const today = this.todayIso();
    const state = this.database.store.getState();
    const dates = new Set<string>();
    for (const s of state.sales) {
      const d = s.createdAt.slice(0, 10);
      if (d.length === 10 && d < today) dates.add(d);
    }
    const sorted = Array.from(dates).sort();
    const results: ClosureRunResult[] = [];
    for (const d of sorted) {
      if (this.database.sales.hasClosureForDate(d)) continue;
      try {
        results.push(this.runClosureForDate(d, undefined, { source: "startup_catchup" }));
      } catch {
        /* bir gun yazilamazsa digerlerine devam */
      }
    }
    return results;
  }

  runClosureForDate(
    date: string,
    actualCashKurus?: number,
    opts?: { source?: "manual" | "startup_catchup" }
  ): ClosureRunResult {
    const ymd = String(date ?? "").trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      throw new Error("Gecersiz tarih (YYYY-MM-DD).");
    }
    const existing = this.database.sales.getClosureForDate(ymd);
    const summary = this.database.sales.getSummaryByDate(ymd);
    const profit = this.database.sales.getProfitDetailForDate(ymd);
    const profitKurus = summary.grossRevenueKurus - profit.costTotalKurus;
    const openingCashKurus =
      this.database.settings.get().openingCashDate === ymd ? this.database.settings.get().openingCashKurus : 0;
    const expectedCashKurus = openingCashKurus + summary.cashTotalKurus;
    const hasActualCash = actualCashKurus != null && Number.isFinite(actualCashKurus) && actualCashKurus >= 0;
    let normalizedActualCashKurus = hasActualCash ? Math.round(Number(actualCashKurus)) : null;
    if (
      normalizedActualCashKurus == null &&
      existing?.actualCashKurus != null &&
      Number.isFinite(existing.actualCashKurus)
    ) {
      normalizedActualCashKurus = Math.round(existing.actualCashKurus);
    }
    const cashDiffKurus = normalizedActualCashKurus == null ? null : normalizedActualCashKurus - expectedCashKurus;
    const outputDir = path.join(process.cwd(), "reports");
    fs.mkdirSync(outputDir, { recursive: true });
    const reportPath = path.join(outputDir, `kapanis-${ymd}.txt`);
    const lineRows = profit.lines.map((r) => {
      const qtyCol = formatQtyShort(r.qty, r.saleUnit);
      const gelisBirim = r.saleUnit === "gram" ? `${formatTry(r.unitCostKurus)}/1000g` : `${formatTry(r.unitCostKurus)}/adet`;
      const satisBirim = r.saleUnit === "gram" ? `${formatTry(r.unitPriceKurus)}/1000g` : `${formatTry(r.unitPriceKurus)}/adet`;
      return (
        `${r.saleCreatedAt}\t#${r.saleId}\t${r.saleKind === "return" ? "IADE" : "SATIS"}\t${r.productCode}\t${r.productName}\t${qtyCol}\t` +
        `gelis ${gelisBirim}\t` +
        `satis ${satisBirim}\t` +
        `maliyet ${formatTry(r.lineCostKurus)}\t` +
        `ciro ${formatTry(r.lineTotalKurus)}\t` +
        `kar ${formatTry(r.lineProfitKurus)}`
      );
    });
    const autoNote =
      opts?.source === "startup_catchup"
        ? `Not: Bu kapanis, tarih degisikliginden sonra uygulama acilirken eksik oldugu icin otomatik alindi.\n`
        : "";
    const reportText = [
      `=== Marina Nargile Gunluk Kapanis ===`,
      `Tarih: ${ymd}`,
      autoNote,
      `Toplam Satis: ${summary.totalSalesCount}`,
      `Nakit: ${formatTry(summary.cashTotalKurus)}`,
      `Kasa acilis: ${formatTry(openingCashKurus)}`,
      `Beklenen kasa: ${formatTry(expectedCashKurus)}`,
      `Gercek sayilan kasa: ${normalizedActualCashKurus == null ? "-" : formatTry(normalizedActualCashKurus)}`,
      `Kasa farki: ${cashDiffKurus == null ? "-" : formatTry(cashDiffKurus)}`,
      `Kart: ${formatTry(summary.cardTotalKurus)}`,
      `Ciro (satis): ${formatTry(summary.grossRevenueKurus)}`,
      `Toplam maliyet (gelis): ${formatTry(profit.costTotalKurus)}`,
      `Brut kar: ${formatTry(profitKurus)}`,
      ``,
      `--- Satir bazinda ---`,
      ...lineRows
    ].join("\n");
    fs.writeFileSync(reportPath, reportText, "utf-8");

    const month = ymd.slice(0, 7);
    const logLine = `${ymd}\tSatis:${summary.totalSalesCount}\tCiro:${formatTry(summary.grossRevenueKurus)}\tMaliyet:${formatTry(profit.costTotalKurus)}\tKar:${formatTry(profitKurus)}\tSatir:${profit.lines.length}\n`;
    this.writeKarNotMonthLine(outputDir, month, ymd, logLine);

    this.database.sales.saveClosure(ymd, reportPath, {
      openingCashKurus,
      expectedCashKurus,
      actualCashKurus: normalizedActualCashKurus,
      cashDiffKurus
    });
    return {
      date: ymd,
      reportPath,
      totalSalesCount: summary.totalSalesCount,
      cashTotalKurus: summary.cashTotalKurus,
      cardTotalKurus: summary.cardTotalKurus,
      grossRevenueKurus: summary.grossRevenueKurus,
      costTotalKurus: profit.costTotalKurus,
      profitKurus,
      saleLineCount: profit.lines.length,
      openingCashKurus,
      expectedCashKurus,
      actualCashKurus: normalizedActualCashKurus,
      cashDiffKurus
    };
  }

  /** Ayni gun tekrar kapanista o tarihe ait onceki satiri silip yenisiyle degistirir (aylik notta tek satir). */
  private writeKarNotMonthLine(outputDir: string, month: string, date: string, logLine: string) {
    const monthLogPath = path.join(outputDir, `kar-not-${month}.txt`);
    const trimmed = logLine.trimEnd();
    if (!fs.existsSync(monthLogPath)) {
      fs.writeFileSync(monthLogPath, `${trimmed}\n`, "utf-8");
      return;
    }
    const raw = fs.readFileSync(monthLogPath, "utf-8");
    const prefix = `${date}\t`;
    const kept = raw
      .split(/\r?\n/)
      .map((ln) => ln.trimEnd())
      .filter((ln) => ln.length > 0 && !ln.startsWith(prefix));
    fs.writeFileSync(monthLogPath, [...kept, trimmed].join("\n") + "\n", "utf-8");
  }

  private scheduleNextRun() {
    if (this.timer) clearTimeout(this.timer);
    const { closureTime } = this.database.settings.get();
    const [hour, minute] = closureTime.split(":").map(Number);
    const now = new Date();
    const next = new Date();
    next.setHours(hour, minute, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    const timeoutMs = next.getTime() - now.getTime();
    this.timer = setTimeout(() => {
      try {
        if (!this.database.sales.hasClosureForDate(this.todayIso())) {
          const result = this.runClosureForDate(this.todayIso(), undefined, { source: "manual" });
          this.onAutoClosureCompleted?.(result);
        }
      } catch {
        // Otomatik kapanis bir sonraki plana gecsin; hata UI'da manuel alinda gorunur.
      } finally {
        this.scheduleNextRun();
      }
    }, timeoutMs);
  }
}
