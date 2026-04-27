import { DayProfitDetail, DayProfitLine, PaymentType, SaleKind, SaleRecord, StockAgingRow } from "../../types/models";
import { JsonStore } from "../store";

export interface MonthlySaleLineExport {
  satisTarihi: string;
  satisId: number;
  odemeTipi: PaymentType;
  urunId: number;
  urunAdi: string;
  urunKodu: string;
  miktar: number;
  birimGelisTl: number;
  birimSatisTl: number;
  maliyetToplamTl: number;
  satisToplamTl: number;
  karTl: number;
}

export interface MonthlyDayTotalExport {
  tarih: string;
  satisAdedi: number;
  ciroTl: number;
  maliyetTl: number;
  karTl: number;
}

export class SalesRepository {
  constructor(private store: JsonStore) {}

  create(items: Array<{ productId: number; qty: number }>, paymentType: PaymentType, paidAmount: number, kind: SaleKind = "sale") {
    const state = this.store.getState();
    let subtotalKurus = 0;
    const normalized = items.map((item) => {
      const product = state.products.find((p) => p.id === item.productId && p.isActive === 1);
      if (!product) throw new Error("Urun bulunamadi.");
      if (kind === "sale" && product.stockQty < item.qty) throw new Error("Yetersiz stok.");
      const sign = kind === "return" ? -1 : 1;
      const lineTotalKurus = item.qty * product.priceKurus * sign;
      const unitCostKurus = product.costPriceKurus ?? 0;
      const lineCostKurus = item.qty * unitCostKurus * sign;
      subtotalKurus += lineTotalKurus;
      return { ...item, unitPriceKurus: product.priceKurus, lineTotalKurus, unitCostKurus, lineCostKurus };
    });

    const effectivePaidAmountKurus = kind === "return" ? subtotalKurus : paymentType === "card" ? subtotalKurus : paidAmount;
    if (paymentType === "cash" && effectivePaidAmountKurus < subtotalKurus) throw new Error("Alinan tutar yetersiz.");
    const changeAmountKurus = effectivePaidAmountKurus - subtotalKurus;
    state.sequences.saleId += 1;
    const saleId = state.sequences.saleId;
    state.sales.push({
      id: saleId,
      createdAt: new Date().toISOString(),
      kind,
      paymentType,
      subtotalKurus,
      paidAmountKurus: effectivePaidAmountKurus,
      changeAmountKurus
    });

    for (const item of normalized) {
      state.sequences.saleItemId += 1;
      state.saleItems.push({
        id: state.sequences.saleItemId,
        saleId,
        productId: item.productId,
        qty: item.qty,
        unitPriceKurus: item.unitPriceKurus,
        lineTotalKurus: item.lineTotalKurus,
        unitCostKurus: item.unitCostKurus,
        lineCostKurus: item.lineCostKurus
      });
      const product = state.products.find((p) => p.id === item.productId)!;
      product.stockQty += kind === "return" ? item.qty : -item.qty;
      state.sequences.stockMovementId += 1;
      state.stockMovements.push({
        id: state.sequences.stockMovementId,
        productId: item.productId,
        type: kind === "return" ? "in" : "out",
        qty: item.qty,
        note: kind === "return" ? "Iade" : "Satis",
        createdAt: new Date().toISOString()
      });
    }
    this.store.save();
  }

  getByDate(date: string): SaleRecord[] {
    return this.store
      .getState()
      .sales.filter((s) => s.createdAt.slice(0, 10) === date)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getSummaryByDate(date: string) {
    const sales = this.getByDate(date);
    return {
      totalSalesCount: sales.length,
      cashTotalKurus: sales.filter((s) => s.paymentType === "cash").reduce((sum, x) => sum + x.subtotalKurus, 0),
      cardTotalKurus: sales.filter((s) => s.paymentType === "card").reduce((sum, x) => sum + x.subtotalKurus, 0),
      grossRevenueKurus: sales.reduce((sum, x) => sum + x.subtotalKurus, 0)
    };
  }

  getProfitDetailForDate(date: string): DayProfitDetail {
    const state = this.store.getState();
    const daySales = state.sales.filter((s) => s.createdAt.slice(0, 10) === date);
    const saleIds = new Set(daySales.map((s) => s.id));
    const items = state.saleItems.filter((i) => saleIds.has(i.saleId));
    const lines: DayProfitLine[] = items.map((item) => {
      const p = state.products.find((x) => x.id === item.productId);
      const sale = state.sales.find((s) => s.id === item.saleId)!;
      const unitCostKurus = item.unitCostKurus ?? 0;
      const lineCostKurus = item.lineCostKurus ?? item.qty * unitCostKurus;
      const lineProfitKurus = item.lineTotalKurus - lineCostKurus;
      return {
        saleItemId: item.id,
        saleId: item.saleId,
        saleCreatedAt: sale.createdAt,
        saleKind: sale.kind ?? "sale",
        productId: item.productId,
        productName: p?.name ?? "(silinmis urun)",
        productCode: p?.code ?? "",
        qty: item.qty,
        unitCostKurus,
        unitPriceKurus: item.unitPriceKurus,
        lineCostKurus,
        lineTotalKurus: item.lineTotalKurus,
        lineProfitKurus
      };
    });
    lines.sort((a, b) => a.saleCreatedAt.localeCompare(b.saleCreatedAt) || a.saleId - b.saleId);
    const revenueKurus = items.reduce((s, i) => s + i.lineTotalKurus, 0);
    const costTotalKurus = items.reduce((s, i) => s + (i.lineCostKurus ?? i.qty * (i.unitCostKurus ?? 0)), 0);
    return {
      revenueKurus,
      costTotalKurus,
      profitKurus: revenueKurus - costTotalKurus,
      lines
    };
  }

  saveClosure(
    date: string,
    reportPath: string,
    cashReconciliation?: {
      openingCashKurus: number;
      expectedCashKurus: number;
      actualCashKurus: number | null;
      cashDiffKurus: number | null;
    }
  ) {
    const summary = this.getSummaryByDate(date);
    const profit = this.getProfitDetailForDate(date);
    const state = this.store.getState();
    state.sequences.closureId += 1;
    state.closures.push({
      id: state.sequences.closureId,
      closureDate: date,
      totalSalesCount: summary.totalSalesCount,
      cashTotalKurus: summary.cashTotalKurus,
      cardTotalKurus: summary.cardTotalKurus,
      grossRevenueKurus: summary.grossRevenueKurus,
      costTotalKurus: profit.costTotalKurus,
      profitKurus: summary.grossRevenueKurus - profit.costTotalKurus,
      reportPath,
      openingCashKurus: cashReconciliation?.openingCashKurus,
      expectedCashKurus: cashReconciliation?.expectedCashKurus,
      actualCashKurus: cashReconciliation?.actualCashKurus,
      cashDiffKurus: cashReconciliation?.cashDiffKurus
    });
    this.store.save();
  }

  getMonthlySaleLineExports(yearMonth: string): MonthlySaleLineExport[] {
    const state = this.store.getState();
    const ym = yearMonth.slice(0, 7);
    const sales = state.sales.filter((s) => s.createdAt.slice(0, 7) === ym);
    const saleIds = new Set(sales.map((s) => s.id));
    const items = state.saleItems.filter((i) => saleIds.has(i.saleId));
    const saleById = new Map(sales.map((s) => [s.id, s]));
    return items
      .map((item) => {
        const sale = saleById.get(item.saleId)!;
        const p = state.products.find((x) => x.id === item.productId);
        const unitCostKurus = item.unitCostKurus ?? 0;
        const lineCostKurus = item.lineCostKurus ?? item.qty * unitCostKurus;
        return {
          satisTarihi: sale.createdAt,
          satisId: item.saleId,
          odemeTipi: sale.paymentType,
          urunId: item.productId,
          urunAdi: p?.name ?? "(bilinmiyor)",
          urunKodu: p?.code ?? "",
          miktar: item.qty,
          birimGelisTl: this.kurusToTlNum(unitCostKurus),
          birimSatisTl: this.kurusToTlNum(item.unitPriceKurus),
          maliyetToplamTl: this.kurusToTlNum(lineCostKurus),
          satisToplamTl: this.kurusToTlNum(item.lineTotalKurus),
          karTl: this.kurusToTlNum(item.lineTotalKurus - lineCostKurus)
        };
      })
      .sort((a, b) => a.satisTarihi.localeCompare(b.satisTarihi));
  }

  getMonthlyDayTotals(yearMonth: string): MonthlyDayTotalExport[] {
    const state = this.store.getState();
    const ym = yearMonth.slice(0, 7);
    const days = new Set<string>();
    state.sales.forEach((s) => {
      if (s.createdAt.slice(0, 7) === ym) days.add(s.createdAt.slice(0, 10));
    });
    return Array.from(days)
      .sort()
      .map((tarih) => {
        const sales = state.sales.filter((s) => s.createdAt.slice(0, 10) === tarih);
        const saleIds = new Set(sales.map((s) => s.id));
        const items = state.saleItems.filter((i) => saleIds.has(i.saleId));
        const ciroKurus = items.reduce((s, i) => s + i.lineTotalKurus, 0);
        const malKurus = items.reduce((s, i) => s + (i.lineCostKurus ?? i.qty * (i.unitCostKurus ?? 0)), 0);
        return {
          tarih,
          satisAdedi: sales.length,
          ciroTl: this.kurusToTlNum(ciroKurus),
          maliyetTl: this.kurusToTlNum(malKurus),
          karTl: this.kurusToTlNum(ciroKurus - malKurus)
        };
      });
  }

  getStockAging(): StockAgingRow[] {
    const state = this.store.getState();
    const rows: StockAgingRow[] = [];
    const nowMs = Date.now();
    for (const product of state.products.filter((p) => p.isActive === 1)) {
      const movements = state.stockMovements
        .filter((m) => m.productId === product.id)
        .slice()
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const stockBatches: Array<{ qty: number; createdAt: string }> = [];
      let soldQty = 0;
      let soldDayWeighted = 0;

      for (const movement of movements) {
        if (movement.type === "in") {
          stockBatches.push({ qty: movement.qty, createdAt: movement.createdAt });
          continue;
        }
        if (movement.type !== "out") continue;
        let remaining = movement.qty;
        while (remaining > 0 && stockBatches.length > 0) {
          const batch = stockBatches[0];
          const take = Math.min(batch.qty, remaining);
          const days = Math.max(0, (new Date(movement.createdAt).getTime() - new Date(batch.createdAt).getTime()) / 86400000);
          soldQty += take;
          soldDayWeighted += days * take;
          batch.qty -= take;
          remaining -= take;
          if (batch.qty <= 0) stockBatches.shift();
        }
      }

      const remainingQty = stockBatches.reduce((sum, b) => sum + b.qty, 0);
      const currentAge =
        remainingQty > 0
          ? stockBatches.reduce((sum, b) => sum + ((nowMs - new Date(b.createdAt).getTime()) / 86400000) * b.qty, 0) / remainingQty
          : null;

      rows.push({
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        stockQty: product.stockQty,
        soldQty,
        avgDaysToSell: soldQty > 0 ? soldDayWeighted / soldQty : null,
        currentStockAgeDays: currentAge
      });
    }
    return rows.sort((a, b) => (b.currentStockAgeDays ?? -1) - (a.currentStockAgeDays ?? -1));
  }

  private kurusToTlNum(k: number): number {
    return Math.round(k) / 100;
  }
}
