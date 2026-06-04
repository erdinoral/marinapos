import type { CashflowEntry, CashflowEntryInput, CashflowKind, CashflowMonthlySummary } from "../../types/models";
import { saleCollectedKurus } from "../../utils/saleCollected";
import { JsonStore } from "../store";

function ymFromDate(d: string): string {
  const t = String(d ?? "").trim();
  return t.length >= 7 ? t.slice(0, 7) : "";
}

export class CashflowRepository {
  constructor(private store: JsonStore) {}

  /** Ay icin tum kayitlar (ek gelir + gunluk gider: entryDate ayi; aylik gider: billingMonth) */
  listForMonth(yearMonth: string): CashflowEntry[] {
    const ym = yearMonth.slice(0, 7);
    return this.store
      .getState()
      .cashflowEntries.filter((e) => {
        if (e.kind === "expense_monthly") return e.billingMonth === ym;
        return ymFromDate(e.entryDate) === ym;
      })
      .slice()
      .sort((a, b) => b.entryDate.localeCompare(a.entryDate) || b.id - a.id);
  }

  getMonthlySummary(yearMonth: string): CashflowMonthlySummary {
    const ym = yearMonth.slice(0, 7);
    const state = this.store.getState();
    let salesNetKurus = 0;
    for (const s of state.sales) {
      if (String(s.createdAt ?? "").slice(0, 7) !== ym) continue;
      salesNetKurus += saleCollectedKurus(s);
    }
    const entries = this.listForMonth(ym);
    const extraIncomeKurus = entries.filter((e) => e.kind === "extra_income").reduce((sum, e) => sum + e.amountKurus, 0);
    const dailyExpenseKurus = entries.filter((e) => e.kind === "expense_daily").reduce((sum, e) => sum + e.amountKurus, 0);
    const stockPurchaseExpenseKurus = entries
      .filter((e) => e.kind === "expense_daily" && e.stockMovementId != null && e.stockMovementId > 0)
      .reduce((sum, e) => sum + e.amountKurus, 0);
    const otherDailyExpenseKurus = Math.max(0, dailyExpenseKurus - stockPurchaseExpenseKurus);
    const monthlyExpenseKurus = entries.filter((e) => e.kind === "expense_monthly").reduce((sum, e) => sum + e.amountKurus, 0);
    const manualOutKurus = dailyExpenseKurus + monthlyExpenseKurus;
    const totalInflowKurus = salesNetKurus + extraIncomeKurus;
    const balanceKurus = totalInflowKurus - manualOutKurus;
    return {
      yearMonth: ym,
      salesNetKurus,
      extraIncomeKurus,
      dailyExpenseKurus,
      stockPurchaseExpenseKurus,
      otherDailyExpenseKurus,
      monthlyExpenseKurus,
      manualExpenseTotalKurus: manualOutKurus,
      totalInflowKurus,
      balanceKurus
    };
  }

  create(payload: CashflowEntryInput): CashflowEntry {
    const kind = payload.kind as CashflowKind;
    if (kind !== "extra_income" && kind !== "expense_daily" && kind !== "expense_monthly") {
      throw new Error("Gecersiz kayit turu.");
    }
    const amountKurus = Math.max(0, Math.round(Number(payload.amountKurus ?? 0)));
    if (amountKurus <= 0) throw new Error("Tutar sifirdan buyuk olmalidir.");
    const category = String(payload.category ?? "").trim() || (kind === "extra_income" ? "Ek gelir" : "Gider");
    const note = String(payload.note ?? "").trim();
    const createdAt = new Date().toISOString();
    let entryDate = String(payload.entryDate ?? "").trim().slice(0, 10);
    let billingMonth = String(payload.billingMonth ?? "").trim().slice(0, 7);
    if (kind === "expense_monthly") {
      if (!/^\d{4}-\d{2}$/.test(billingMonth)) throw new Error("Aylik gider icin ay (YYYY-MM) gerekli.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) entryDate = `${billingMonth}-01`;
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) throw new Error("Gecerli tarih (YYYY-MM-DD) girin.");
      billingMonth = entryDate.slice(0, 7);
    }
    const state = this.store.getState();
    state.sequences.cashflowEntryId += 1;
    const row: CashflowEntry = {
      id: state.sequences.cashflowEntryId,
      kind,
      entryDate,
      billingMonth,
      amountKurus,
      category,
      note,
      createdAt
    };
    state.cashflowEntries.push(row);
    this.store.save();
    return { ...row };
  }

  delete(entryId: number): void {
    const state = this.store.getState();
    const before = state.cashflowEntries.length;
    state.cashflowEntries = state.cashflowEntries.filter((e) => e.id !== entryId);
    if (state.cashflowEntries.length === before) throw new Error("Kayit bulunamadi.");
    this.store.save();
  }
}
