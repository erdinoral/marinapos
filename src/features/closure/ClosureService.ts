import fs from "node:fs";
import path from "node:path";
import { DatabaseService } from "../../db/databaseService";
import { ClosureRunResult } from "../../types/models";
import { formatTry } from "../../utils/currency";

export class ClosureService {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private database: DatabaseService,
    private onAutoClosureCompleted?: (result: ClosureRunResult) => void
  ) {}

  startScheduler() {
    this.scheduleNextRun();
  }

  runClosureForToday(actualCashKurus?: number): ClosureRunResult {
    const date = new Date().toISOString().slice(0, 10);
    const summary = this.database.sales.getSummaryByDate(date);
    const profit = this.database.sales.getProfitDetailForDate(date);
    const profitKurus = summary.grossRevenueKurus - profit.costTotalKurus;
    const openingCashKurus =
      this.database.settings.get().openingCashDate === date ? this.database.settings.get().openingCashKurus : 0;
    const expectedCashKurus = openingCashKurus + summary.cashTotalKurus;
    const hasActualCash = actualCashKurus != null && Number.isFinite(actualCashKurus) && actualCashKurus >= 0;
    const normalizedActualCashKurus = hasActualCash ? Math.round(actualCashKurus) : null;
    const cashDiffKurus = normalizedActualCashKurus == null ? null : normalizedActualCashKurus - expectedCashKurus;
    const outputDir = path.join(process.cwd(), "reports");
    fs.mkdirSync(outputDir, { recursive: true });
    const reportPath = path.join(outputDir, `kapanis-${date}.txt`);
    const lineRows = profit.lines.map(
      (r) =>
        `${r.saleCreatedAt}\t#${r.saleId}\t${r.saleKind === "return" ? "IADE" : "SATIS"}\t${r.productCode}\t${r.productName}\t${r.qty}x\t` +
        `gelis ${formatTry(r.unitCostKurus)}/ad\t` +
        `satis ${formatTry(r.unitPriceKurus)}/ad\t` +
        `maliyet ${formatTry(r.lineCostKurus)}\t` +
        `ciro ${formatTry(r.lineTotalKurus)}\t` +
        `kar ${formatTry(r.lineProfitKurus)}`
    );
    const reportText = [
      `=== Marina Nargile Gunluk Kapanis ===`,
      `Tarih: ${date}`,
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

    const month = date.slice(0, 7);
    const monthLogPath = path.join(outputDir, `kar-not-${month}.txt`);
    const logLine = `${date}\tSatis:${summary.totalSalesCount}\tCiro:${formatTry(summary.grossRevenueKurus)}\tMaliyet:${formatTry(profit.costTotalKurus)}\tKar:${formatTry(profitKurus)}\tSatir:${profit.lines.length}\n`;
    fs.appendFileSync(monthLogPath, logLine, "utf-8");

    this.database.sales.saveClosure(date, reportPath, {
      openingCashKurus,
      expectedCashKurus,
      actualCashKurus: normalizedActualCashKurus,
      cashDiffKurus
    });
    return {
      date,
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
      const result = this.runClosureForToday();
      this.onAutoClosureCompleted?.(result);
      this.scheduleNextRun();
    }, timeoutMs);
  }
}
