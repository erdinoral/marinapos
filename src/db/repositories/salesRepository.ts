import {
  CategorySaleUnit,
  CartSalesSummary,
  CustomerStats,
  DayProfitDetail,
  DayProfitLine,
  MonthEndClosureRow,
  MonthEndReport,
  MonthlyDayTotal,
  PaymentType,
  SaleKind,
  SaleLineDetail,
  SaleLineInput,
  SaleRecord,
  SaleWithLines,
  StockAgingRow,
  TopSellingProduct
} from "../../types/models";
import { saleCollectedKurus } from "../../utils/saleCollected";
import { JsonStore } from "../store";
import { consumeFifo, restoreFifoOnReturn } from "../../utils/fifoStockCost";
import { categorySaleUnitOf, gramLineTotalKurus, normalizeGramCartQty } from "../../utils/saleUnit";

export interface MonthlySaleLineExport {
  satisTarihi: string;
  satisId: number;
  odemeTipi: PaymentType;
  urunId: number;
  urunAdi: string;
  urunKodu: string;
  miktar: number;
  /** Excel: adet veya gram satiri */
  miktarBirimi: "adet" | "gram";
  /** Adet: TL/adet. Gram: TL / 1000 g (1000 g paket birim gelis). */
  birimGelisTl: number;
  /** Adet: TL/adet. Gram: TL / 1000 g (1000 g paket birim satis). */
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

export interface TopSellingProductRow {
  productId: number;
  productName: string;
  productCode: string;
  qty: number;
  revenueKurus: number;
}

export interface DashboardReport {
  productsCount: number;
  activeProductsCount: number;
  categoriesCount: number;
  lowStockCount: number;
  stockMovementsCount: number;
  closuresCount: number;
  salesCount: number;
  revenueKurus: number;
  costKurus: number;
  profitKurus: number;
  cashKurus: number;
  cardKurus: number;
  cartSummaries: Array<{
    cartName: string;
    salesCount: number;
    totalKurus: number;
    avgSaleKurus: number;
  }>;
}

export class SalesRepository {
  constructor(private store: JsonStore) {}

  hasClosureForDate(date: string): boolean {
    return this.store.getState().closures.some((c) => c.closureDate === date);
  }

  getClosureForDate(date: string) {
    const row = this.store
      .getState()
      .closures.filter((c) => c.closureDate === date)
      .sort((a, b) => b.id - a.id)[0];
    return row ? { ...row } : null;
  }

  create(
    items: SaleLineInput[],
    paymentType: PaymentType,
    paidAmount: number,
    kind: SaleKind = "sale",
    cartName = "Sepet 1",
    customerId: number | null | undefined = undefined,
    extraFeeKurus?: number
  ) {
    const state = this.store.getState();
    let resolvedCustomerId: number | undefined;
    if (customerId != null && Number.isFinite(Number(customerId))) {
      const cid = Math.floor(Number(customerId));
      if (cid > 0 && state.customers.some((c) => c.id === cid)) resolvedCustomerId = cid;
    }
    let subtotalKurus = 0;
    const normalized = items.map((item) => {
      const product = state.products.find((p) => p.id === item.productId);
      if (!product) throw new Error("Urun bulunamadi.");
      if (kind === "sale" && product.isActive !== 1) throw new Error("Urun bulunamadi veya pasif.");
      const saleUnit = categorySaleUnitOf(state.categories, product.categoryId);
      const isGram = saleUnit === "gram";
      const qty = isGram ? normalizeGramCartQty(item.qty) : Math.round(item.qty);
      /* Stok eksiye dusebilir; stok girisi sonrasi bakiye otomatik duzelir */
      const sign = kind === "return" ? -1 : 1;
      const discount = Math.max(0, Math.min(100, Number(product.discountPercent ?? 0)));
      const override =
        item.unitPriceKurus != null && Number.isFinite(item.unitPriceKurus) ? Math.round(item.unitPriceKurus) : null;
      const effectiveUnitPriceKurus =
        override != null ? Math.max(0, override) : Math.round((product.priceKurus * (100 - discount)) / 100);
      const lineTotalKurus = isGram
        ? item.lineTotalKurus != null && Number.isFinite(item.lineTotalKurus)
          ? Math.max(0, Math.round(item.lineTotalKurus)) * sign
          : gramLineTotalKurus(effectiveUnitPriceKurus, qty) * sign
        : Math.round(qty * effectiveUnitPriceKurus) * sign;
      let unitCostKurus = product.costPriceKurus ?? 0;
      let lineCostKurus = 0;
      if (kind === "sale") {
        const fifo = consumeFifo(state, product.id, qty, saleUnit);
        unitCostKurus = fifo.unitCostKurus;
        lineCostKurus = fifo.lineCostKurus * sign;
      } else {
        if (isGram && item.unitCostKurus != null && Number.isFinite(item.unitCostKurus)) {
          unitCostKurus = Math.max(0, Math.round(item.unitCostKurus));
        } else if (item.unitCostKurus != null && Number.isFinite(item.unitCostKurus)) {
          unitCostKurus = Math.max(0, Math.round(item.unitCostKurus));
        }
        lineCostKurus = isGram
          ? gramLineTotalKurus(unitCostKurus, qty) * sign
          : Math.round(qty * unitCostKurus) * sign;
        restoreFifoOnReturn(state, product.id, qty, unitCostKurus, saleUnit);
      }
      subtotalKurus += lineTotalKurus;
      return { ...item, qty, unitPriceKurus: effectiveUnitPriceKurus, lineTotalKurus, unitCostKurus, lineCostKurus };
    });

    const extraRaw = kind === "sale" ? Math.max(0, Math.round(Number(extraFeeKurus) || 0)) : 0;
    subtotalKurus += extraRaw;

    const roundedPaid = Math.round(Number(paidAmount) || 0);
    let paidAmountKurus = subtotalKurus;
    let changeAmountKurus = 0;
    let debtAddedKurus = 0;
    let debtPaidKurus = 0;

    const applySurplusToCustomerDebt = (amountPaidKurus: number) => {
      if (!resolvedCustomerId) return;
      const surplus = Math.max(0, amountPaidKurus - subtotalKurus);
      if (surplus <= 0) return;
      const customer = state.customers.find((c) => c.id === resolvedCustomerId);
      if (!customer || customer.balanceOwedKurus <= 0) return;
      const applied = Math.min(surplus, customer.balanceOwedKurus);
      customer.balanceOwedKurus -= applied;
      debtPaidKurus += applied;
    };

    if (kind === "return") {
      paidAmountKurus = subtotalKurus;
    } else if (paymentType === "card") {
      const cardPaid = roundedPaid;
      if (cardPaid >= subtotalKurus) {
        paidAmountKurus = subtotalKurus;
        applySurplusToCustomerDebt(cardPaid);
      } else {
        paidAmountKurus = cardPaid;
        debtAddedKurus = subtotalKurus - cardPaid;
        if (debtAddedKurus > 0) {
          if (!resolvedCustomerId) {
            throw new Error("Eksik odeme borca yazilmasi icin musteri secilmelidir.");
          }
          const customer = state.customers.find((c) => c.id === resolvedCustomerId);
          if (customer) customer.balanceOwedKurus += debtAddedKurus;
        }
      }
    } else {
      /** Bos alan = tam odeme; 0 TL girilirse gercekten sifir odeme kabul edilir */
      const cashPaid = roundedPaid;
      if (cashPaid >= subtotalKurus) {
        paidAmountKurus = cashPaid;
        const surplus = cashPaid - subtotalKurus;
        if (resolvedCustomerId && surplus > 0) {
          const customer = state.customers.find((c) => c.id === resolvedCustomerId);
          if (customer && customer.balanceOwedKurus > 0) {
            const applied = Math.min(surplus, customer.balanceOwedKurus);
            customer.balanceOwedKurus -= applied;
            debtPaidKurus = applied;
            changeAmountKurus = surplus - applied;
          } else {
            changeAmountKurus = surplus;
          }
        } else {
          changeAmountKurus = surplus;
        }
      } else {
        paidAmountKurus = cashPaid;
        debtAddedKurus = subtotalKurus - cashPaid;
        if (debtAddedKurus > 0) {
          if (!resolvedCustomerId) {
            throw new Error("Eksik odeme borca yazilmasi icin musteri secilmelidir.");
          }
          const customer = state.customers.find((c) => c.id === resolvedCustomerId);
          if (customer) customer.balanceOwedKurus += debtAddedKurus;
        }
      }
    }

    state.sequences.saleId += 1;
    const saleId = state.sequences.saleId;
    state.sales.push({
      id: saleId,
      createdAt: new Date().toISOString(),
      kind,
      cartName: cartName.trim() || "Sepet 1",
      paymentType,
      subtotalKurus,
      ...(extraRaw > 0 ? { extraFeeKurus: extraRaw } : {}),
      paidAmountKurus,
      changeAmountKurus,
      ...(debtAddedKurus > 0 ? { debtAddedKurus } : {}),
      ...(debtPaidKurus > 0 ? { debtPaidKurus } : {}),
      ...(resolvedCustomerId != null ? { customerId: resolvedCustomerId } : {})
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

  /** Musteri borc tahsilati: gelir / bugunun satislari / kasa ozetine yansir. */
  recordDebtPayment(
    customerId: number,
    paymentType: PaymentType,
    amountKurus?: number,
    paymentNote?: string
  ): SaleRecord {
    const state = this.store.getState();
    const cid = Math.floor(Number(customerId));
    if (!Number.isFinite(cid) || cid <= 0) throw new Error("Musteri secilmelidir.");
    const customer = state.customers.find((c) => c.id === cid);
    if (!customer) throw new Error("Musteri bulunamadi.");
    const balance = Math.max(0, Math.round(customer.balanceOwedKurus));
    if (balance <= 0) throw new Error("Acik borc yok.");
    const pay =
      amountKurus != null && Number.isFinite(Number(amountKurus))
        ? Math.max(0, Math.round(Number(amountKurus)))
        : balance;
    if (pay <= 0) throw new Error("Odeme tutari gecersiz.");
    if (pay > balance) throw new Error("Odeme tutari acik borctan fazla.");
    customer.balanceOwedKurus = balance - pay;
    state.sequences.saleId += 1;
    const saleId = state.sequences.saleId;
    const noteTrim = String(paymentNote ?? "").trim();
    const row: SaleRecord = {
      id: saleId,
      createdAt: new Date().toISOString(),
      kind: "debt_payment",
      cartName: "Borc odemesi",
      paymentType,
      subtotalKurus: 0,
      paidAmountKurus: pay,
      changeAmountKurus: 0,
      debtPaidKurus: pay,
      customerId: cid,
      ...(noteTrim ? { paymentNote: noteTrim } : {})
    };
    state.sales.push(row);
    this.store.save();
    return { ...row };
  }

  getByDate(date: string): SaleRecord[] {
    return this.store
      .getState()
      .sales.filter((s) => s.createdAt.slice(0, 10) === date)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Gunluk satis listesinde urun / kategori filtresi icin: saleId -> satirdaki urun id'leri */
  getProductIdsBySaleForDate(date: string): Record<number, number[]> {
    const state = this.store.getState();
    const saleIds = new Set(
      state.sales.filter((s) => s.createdAt.slice(0, 10) === date).map((s) => s.id)
    );
    const map: Record<number, number[]> = {};
    for (const item of state.saleItems) {
      if (!saleIds.has(item.saleId)) continue;
      const bucket = map[item.saleId] ?? (map[item.saleId] = []);
      if (!bucket.includes(item.productId)) bucket.push(item.productId);
    }
    return map;
  }

  getSaleWithLines(saleId: number): SaleWithLines | null {
    const state = this.store.getState();
    const sale = state.sales.find((s) => s.id === saleId);
    if (!sale) return null;
    const items: SaleLineDetail[] = state.saleItems
      .filter((i) => i.saleId === saleId)
      .map((i) => {
        const p = state.products.find((x) => x.id === i.productId);
        const cat = p ? state.categories.find((c) => c.id === p.categoryId) : undefined;
        const saleUnit: CategorySaleUnit = cat?.saleUnit === "gram" ? "gram" : "piece";
        return {
          saleItemId: i.id,
          productId: i.productId,
          productName: p?.name ?? "(urun)",
          productCode: p?.code ?? "",
          qty: i.qty,
          unitPriceKurus: i.unitPriceKurus,
          lineTotalKurus: i.lineTotalKurus,
          saleUnit
        };
      });
    const saleEx = (sale as { extraFeeKurus?: number }).extraFeeKurus;
    const ex = Math.max(0, Math.round(Number(saleEx) || 0));
    if (ex > 0) {
      items.push({
        productId: -1,
        productName: "Kart (Ozel)",
        productCode: "—",
        qty: 1,
        unitPriceKurus: ex,
        lineTotalKurus: ex,
        saleUnit: "piece"
      });
    }
    return {
      sale: {
        id: sale.id,
        createdAt: sale.createdAt,
        kind: sale.kind ?? "sale",
        cartName: sale.cartName,
        paymentType: sale.paymentType,
        subtotalKurus: sale.subtotalKurus,
        paidAmountKurus: sale.paidAmountKurus,
        changeAmountKurus: sale.changeAmountKurus,
        ...(ex > 0 ? { extraFeeKurus: ex } : {}),
        ...(sale.debtAddedKurus != null && sale.debtAddedKurus > 0 ? { debtAddedKurus: sale.debtAddedKurus } : {}),
        ...(sale.debtPaidKurus != null && sale.debtPaidKurus > 0 ? { debtPaidKurus: sale.debtPaidKurus } : {}),
        ...(sale.customerId != null && sale.customerId > 0 ? { customerId: sale.customerId } : {})
      },
      items
    };
  }

  getCustomerStats(customerId: number): CustomerStats | null {
    const state = this.store.getState();
    if (!state.customers.some((c) => c.id === customerId)) return null;
    const rows = state.sales.filter((s) => s.customerId === customerId);
    let netTotalKurus = 0;
    let lastTransactionAt: string | null = null;
    for (const s of rows) {
      netTotalKurus += s.subtotalKurus;
      if (!lastTransactionAt || s.createdAt > lastTransactionAt) lastTransactionAt = s.createdAt;
    }
    return {
      customerId,
      transactionCount: rows.length,
      netTotalKurus,
      lastTransactionAt
    };
  }

  getSalesForCustomer(customerId: number, limit = 20): SaleWithLines[] {
    const state = this.store.getState();
    if (!state.customers.some((c) => c.id === customerId)) return [];
    const cap = Math.max(1, Math.min(80, Math.floor(Number(limit) || 20)));
    const rows = state.sales
      .filter((s) => s.customerId === customerId)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, cap);
    return rows.map((s) => this.getSaleWithLines(s.id)).filter((x): x is SaleWithLines => x != null);
  }

  getRecentSalesWithLines(date: string, limit = 5): SaleWithLines[] {
    const sales = this.getByDate(date).slice(0, Math.max(1, Math.min(50, limit)));
    return sales.map((s) => this.getSaleWithLines(s.id)).filter((x): x is SaleWithLines => x != null);
  }

  /** Tum satis gecmisi (en yeni ustte). limit <= 0 veya bos = tum kayitlar. */
  listSalesHistory(limit?: number): { sales: SaleRecord[]; productIdsBySale: Record<number, number[]> } {
    const state = this.store.getState();
    const sorted = state.sales.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const rawLimit = Number(limit);
    const sales =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? sorted.slice(0, Math.min(50000, Math.floor(rawLimit)))
        : sorted;
    const productIdsBySale: Record<number, number[]> = {};
    for (const item of state.saleItems) {
      const bucket = productIdsBySale[item.saleId] ?? (productIdsBySale[item.saleId] = []);
      if (!bucket.includes(item.productId)) bucket.push(item.productId);
    }
    return { sales, productIdsBySale };
  }

  getSummaryByDate(date: string) {
    const sales = this.getByDate(date);
    let cashTotalKurus = 0;
    let cardTotalKurus = 0;
    for (const s of sales) {
      const collected = saleCollectedKurus(s);
      if (s.paymentType === "cash") cashTotalKurus += collected;
      else cardTotalKurus += collected;
    }
    return {
      totalSalesCount: sales.length,
      cashTotalKurus,
      cardTotalKurus,
      grossRevenueKurus: cashTotalKurus + cardTotalKurus
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
      const cat = p ? state.categories.find((c) => c.id === p.categoryId) : undefined;
      const saleUnit: CategorySaleUnit = cat?.saleUnit === "gram" ? "gram" : "piece";
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
        lineProfitKurus,
        saleUnit
      };
    });
    for (const sale of daySales) {
      if ((sale.kind ?? "sale") !== "sale") continue;
      const ex = Math.max(0, Math.round(Number((sale as { extraFeeKurus?: number }).extraFeeKurus) || 0));
      if (ex <= 0) continue;
      lines.push({
        saleItemId: -sale.id,
        saleId: sale.id,
        saleCreatedAt: sale.createdAt,
        saleKind: sale.kind ?? "sale",
        productId: -1,
        productName: "Kart (Ozel)",
        productCode: "",
        qty: 1,
        unitCostKurus: 0,
        unitPriceKurus: ex,
        lineCostKurus: 0,
        lineTotalKurus: ex,
        lineProfitKurus: ex,
        saleUnit: "piece"
      });
    }
    lines.sort((a, b) => a.saleCreatedAt.localeCompare(b.saleCreatedAt) || a.saleId - b.saleId);
    const revenueKurus = lines.reduce((s, l) => s + l.lineTotalKurus, 0);
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
    const profitKurus = summary.grossRevenueKurus - profit.costTotalKurus;
    const sameDay = state.closures.filter((c) => c.closureDate === date);
    const rowBody = {
      closureDate: date,
      totalSalesCount: summary.totalSalesCount,
      cashTotalKurus: summary.cashTotalKurus,
      cardTotalKurus: summary.cardTotalKurus,
      grossRevenueKurus: summary.grossRevenueKurus,
      costTotalKurus: profit.costTotalKurus,
      profitKurus,
      reportPath,
      openingCashKurus: cashReconciliation?.openingCashKurus,
      expectedCashKurus: cashReconciliation?.expectedCashKurus,
      actualCashKurus: cashReconciliation?.actualCashKurus,
      cashDiffKurus: cashReconciliation?.cashDiffKurus
    };

    if (sameDay.length === 0) {
      state.sequences.closureId += 1;
      state.closures.push({
        id: state.sequences.closureId,
        ...rowBody
      });
    } else {
      const keep = sameDay.reduce((a, b) => (a.id > b.id ? a : b));
      const keepId = keep.id;
      state.closures = state.closures.filter((c) => c.closureDate !== date || c.id === keepId);
      const row = state.closures.find((c) => c.id === keepId);
      if (row) Object.assign(row, rowBody);
    }
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
        const cat = p ? state.categories.find((c) => c.id === p.categoryId) : undefined;
        const saleUnit: CategorySaleUnit = cat?.saleUnit === "gram" ? "gram" : "piece";
        const miktarBirimi = saleUnit === "gram" ? ("gram" as const) : ("adet" as const);
        return {
          satisTarihi: sale.createdAt,
          satisId: item.saleId,
          odemeTipi: sale.paymentType,
          urunId: item.productId,
          urunAdi: p?.name ?? "(bilinmiyor)",
          urunKodu: p?.code ?? "",
          miktar: item.qty,
          miktarBirimi,
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
    return state.closures
      .filter((c) => c.closureDate.slice(0, 7) === ym)
      .slice()
      .sort((a, b) => a.closureDate.localeCompare(b.closureDate))
      .map((c) => ({
        tarih: c.closureDate,
        satisAdedi: c.totalSalesCount,
        ciroTl: this.kurusToTlNum(c.grossRevenueKurus),
        maliyetTl: this.kurusToTlNum(c.costTotalKurus),
        karTl: this.kurusToTlNum(c.profitKurus)
      }));
  }

  getTopSellingProducts(limit = 8): TopSellingProductRow[] {
    const state = this.store.getState();
    const salesById = new Map(state.sales.map((s) => [s.id, s]));
    const acc = new Map<number, TopSellingProductRow>();
    for (const item of state.saleItems) {
      const sale = salesById.get(item.saleId);
      if (!sale) continue;
      const sign = sale.kind === "return" ? -1 : 1;
      const row = acc.get(item.productId) ?? {
        productId: item.productId,
        productName: "(silinmis urun)",
        productCode: "",
        qty: 0,
        revenueKurus: 0
      };
      row.qty += item.qty * sign;
      row.revenueKurus += item.lineTotalKurus;
      acc.set(item.productId, row);
    }
    const productById = new Map(state.products.map((p) => [p.id, p]));
    return Array.from(acc.values())
      .map((r) => {
        const p = productById.get(r.productId);
        return { ...r, productName: p?.name ?? r.productName, productCode: p?.code ?? r.productCode };
      })
      .filter((r) => r.qty > 0)
      .sort((a, b) => b.qty - a.qty || b.revenueKurus - a.revenueKurus)
      .slice(0, limit);
  }

  /** Secilen ay icin en cok satilan urunler (miktar / ciro) */
  getTopSellingProductsForMonth(yearMonth: string, limit = 20): TopSellingProduct[] {
    const state = this.store.getState();
    const ym = yearMonth.slice(0, 7);
    const salesInMonth = state.sales.filter((s) => s.createdAt.slice(0, 7) === ym);
    const salesById = new Map(salesInMonth.map((s) => [s.id, s]));
    const acc = new Map<number, TopSellingProduct>();
    for (const item of state.saleItems) {
      const sale = salesById.get(item.saleId);
      if (!sale) continue;
      const sign = sale.kind === "return" ? -1 : 1;
      const row =
        acc.get(item.productId) ??
        ({
          productId: item.productId,
          productName: "(silinmis urun)",
          productCode: "",
          qty: 0,
          revenueKurus: 0
        } as TopSellingProduct);
      row.qty += item.qty * sign;
      row.revenueKurus += item.lineTotalKurus;
      acc.set(item.productId, row);
    }
    const productById = new Map(state.products.map((p) => [p.id, p]));
    const cap = Math.max(1, Math.min(50, Math.floor(Number(limit) || 20)));
    return Array.from(acc.values())
      .map((r) => {
        const p = productById.get(r.productId);
        return { ...r, productName: p?.name ?? r.productName, productCode: p?.code ?? r.productCode };
      })
      .filter((r) => r.qty > 0)
      .sort((a, b) => b.qty - a.qty || b.revenueKurus - a.revenueKurus)
      .slice(0, cap);
  }

  /** Ay sonu ozeti (gelir-gider haric; tam raporda cashflow ile birlestirilir) */
  getMonthEndSnapshot(yearMonth: string): Omit<MonthEndReport, "cashflow" | "cashflowEntries"> {
    const state = this.store.getState();
    const ym = yearMonth.slice(0, 7);
    const salesInMonth = state.sales.filter((s) => s.createdAt.slice(0, 7) === ym);
    const saleIds = new Set(salesInMonth.map((s) => s.id));
    const items = state.saleItems.filter((i) => saleIds.has(i.saleId));
    let revenueKurus = items.reduce((s, i) => s + i.lineTotalKurus, 0);
    const costKurus = items.reduce((s, i) => s + (i.lineCostKurus ?? i.qty * (i.unitCostKurus ?? 0)), 0);
    for (const sale of salesInMonth) {
      if ((sale.kind ?? "sale") !== "sale") continue;
      const ex = Math.max(0, Math.round(Number(sale.extraFeeKurus) || 0));
      revenueKurus += ex;
    }
    const profitKurus = revenueKurus - costKurus;
    const cashKurus = salesInMonth.filter((s) => s.paymentType === "cash").reduce((s, x) => s + x.subtotalKurus, 0);
    const cardKurus = salesInMonth.filter((s) => s.paymentType === "card").reduce((s, x) => s + x.subtotalKurus, 0);
    const closures: MonthEndClosureRow[] = state.closures
      .filter((c) => c.closureDate.slice(0, 7) === ym)
      .slice()
      .sort((a, b) => a.closureDate.localeCompare(b.closureDate))
      .map((c) => ({
        closureDate: c.closureDate,
        totalSalesCount: c.totalSalesCount,
        grossRevenueKurus: c.grossRevenueKurus,
        costTotalKurus: c.costTotalKurus,
        profitKurus: c.profitKurus,
        cashTotalKurus: c.cashTotalKurus,
        cardTotalKurus: c.cardTotalKurus
      }));
    const monthlyRows = this.getMonthlyDayTotals(ym);
    const monthlyDayTotals: MonthlyDayTotal[] = monthlyRows.map((r) => ({
      tarih: r.tarih,
      satisAdedi: r.satisAdedi,
      ciroTl: r.ciroTl,
      maliyetTl: r.maliyetTl,
      karTl: r.karTl
    }));
    const cartMap = new Map<string, { salesCount: number; totalKurus: number }>();
    for (const sale of salesInMonth) {
      const key = sale.cartName?.trim() || "Sepet 1";
      const row = cartMap.get(key) ?? { salesCount: 0, totalKurus: 0 };
      row.salesCount += 1;
      row.totalKurus += sale.subtotalKurus;
      cartMap.set(key, row);
    }
    const cartSummaries: CartSalesSummary[] = Array.from(cartMap.entries())
      .map(([cartName, row]) => ({
        cartName,
        salesCount: row.salesCount,
        totalKurus: row.totalKurus,
        avgSaleKurus: row.salesCount > 0 ? Math.round(row.totalKurus / row.salesCount) : 0
      }))
      .sort((a, b) => b.totalKurus - a.totalKurus || b.salesCount - a.salesCount);
    const topSelling = this.getTopSellingProductsForMonth(ym, 24);
    const stockMovementsCount = state.stockMovements.filter((m) => m.createdAt.slice(0, 7) === ym).length;
    return {
      yearMonth: ym,
      revenueKurus,
      costKurus,
      profitKurus,
      salesCount: salesInMonth.length,
      stockMovementsCount,
      cashKurus,
      cardKurus,
      closures,
      monthlyDayTotals,
      cartSummaries,
      topSelling
    };
  }

  getDashboardReport(): DashboardReport {
    const state = this.store.getState();
    const activeProducts = state.products.filter((p) => p.isActive === 1);
    const sales = state.sales;
    const revenueKurus = state.saleItems.reduce((s, i) => s + i.lineTotalKurus, 0);
    const costKurus = state.saleItems.reduce((s, i) => s + (i.lineCostKurus ?? i.qty * (i.unitCostKurus ?? 0)), 0);
    const cashKurus = sales.filter((s) => s.paymentType === "cash").reduce((sum, s) => sum + s.subtotalKurus, 0);
    const cardKurus = sales.filter((s) => s.paymentType === "card").reduce((sum, s) => sum + s.subtotalKurus, 0);
    const cartMap = new Map<string, { salesCount: number; totalKurus: number }>();
    for (const sale of sales) {
      const key = sale.cartName?.trim() || "Sepet 1";
      const row = cartMap.get(key) ?? { salesCount: 0, totalKurus: 0 };
      row.salesCount += 1;
      row.totalKurus += sale.subtotalKurus;
      cartMap.set(key, row);
    }
    const cartSummaries = Array.from(cartMap.entries())
      .map(([cartName, row]) => ({
        cartName,
        salesCount: row.salesCount,
        totalKurus: row.totalKurus,
        avgSaleKurus: row.salesCount > 0 ? Math.round(row.totalKurus / row.salesCount) : 0
      }))
      .sort((a, b) => b.totalKurus - a.totalKurus || b.salesCount - a.salesCount);
    const th = state.settings.lowStockThreshold;
    const lowStockCount = activeProducts.filter((x) => {
      const cat = state.categories.find((c) => c.id === x.categoryId);
      if (cat?.saleUnit === "gram") return false;
      const limit = th;
      return x.stockQty < limit;
    }).length;
    return {
      productsCount: state.products.length,
      activeProductsCount: activeProducts.length,
      categoriesCount: state.categories.length,
      lowStockCount,
      stockMovementsCount: state.stockMovements.length,
      closuresCount: state.closures.length,
      salesCount: sales.length,
      revenueKurus,
      costKurus,
      profitKurus: revenueKurus - costKurus,
      cashKurus,
      cardKurus,
      cartSummaries
    };
  }

  getStockAging(): StockAgingRow[] {
    const state = this.store.getState();
    const rows: StockAgingRow[] = [];
    const nowMs = Date.now();
    for (const product of state.products.filter((p) => p.isActive === 1)) {
      const cat = state.categories.find((c) => c.id === product.categoryId);
      if (cat?.saleUnit === "gram") continue;
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
