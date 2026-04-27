import fs from "node:fs";
import path from "node:path";
import { Category, PaymentType, Product, SaleKind, Settings } from "../types/models";

export interface SaleItem {
  id: number;
  saleId: number;
  productId: number;
  qty: number;
  unitPriceKurus: number;
  lineTotalKurus: number;
  /** Satis anindaki birim gelis (kurus) */
  unitCostKurus: number;
  /** qty * unitCostKurus */
  lineCostKurus: number;
}

export interface Sale {
  id: number;
  createdAt: string;
  kind: SaleKind;
  paymentType: PaymentType;
  subtotalKurus: number;
  paidAmountKurus: number;
  changeAmountKurus: number;
}

export interface StockMovement {
  id: number;
  productId: number;
  type: "in" | "out" | "adjust";
  qty: number;
  note: string;
  createdAt: string;
}

export interface Closure {
  id: number;
  closureDate: string;
  totalSalesCount: number;
  cashTotalKurus: number;
  cardTotalKurus: number;
  grossRevenueKurus: number;
  costTotalKurus: number;
  profitKurus: number;
  reportPath: string;
  openingCashKurus?: number;
  expectedCashKurus?: number;
  actualCashKurus?: number | null;
  cashDiffKurus?: number | null;
}

export interface MarinaStore {
  categories: Category[];
  products: Product[];
  sales: Sale[];
  saleItems: SaleItem[];
  stockMovements: StockMovement[];
  closures: Closure[];
  settings: Settings;
  sequences: {
    productId: number;
    saleId: number;
    saleItemId: number;
    stockMovementId: number;
    closureId: number;
    categoryId: number;
  };
}

export class JsonStore {
  private filePath: string;
  private data: MarinaStore;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.filePath = path.join(dataDir, "marina-pos.json");
    this.data = this.load();
  }

  private load(): MarinaStore {
    if (!fs.existsSync(this.filePath)) {
      return {
        categories: [],
        products: [],
        sales: [],
        saleItems: [],
        stockMovements: [],
        closures: [],
        settings: { openingTime: "09:00", closureTime: "23:00", lowStockThreshold: 10, openingCashKurus: 0, openingCashDate: "" },
        sequences: { productId: 0, saleId: 0, saleItemId: 0, stockMovementId: 0, closureId: 0, categoryId: 0 }
      };
    }
    const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf-8")) as Partial<MarinaStore>;
    return {
      categories: parsed.categories ?? [],
      products: (parsed.products ?? []).map((p) => {
        const priceKurus =
          p.priceKurus ?? Math.round(((p as unknown as { price?: number }).price ?? 0) * 100);
        const rawCost = p.costPriceKurus;
        /** Gelis yok veya 0 ise: ciro uzerinden ~%30 brut kar => maliyet = satis * 0.7 */
        const costPriceKurus =
          rawCost != null && rawCost > 0 ? rawCost : priceKurus > 0 ? Math.round(priceKurus * 0.7) : 0;
        return {
          ...p,
          categoryId: p.categoryId ?? 0,
          priceKurus,
          costPriceKurus
        };
      }),
      sales: (parsed.sales ?? []).map((s) => ({
        ...s,
        kind: s.kind ?? "sale",
        subtotalKurus: s.subtotalKurus ?? Math.round(((s as unknown as { subtotal?: number }).subtotal ?? 0) * 100),
        paidAmountKurus: s.paidAmountKurus ?? Math.round(((s as unknown as { paidAmount?: number }).paidAmount ?? 0) * 100),
        changeAmountKurus: s.changeAmountKurus ?? Math.round(((s as unknown as { changeAmount?: number }).changeAmount ?? 0) * 100)
      })),
      saleItems: (parsed.saleItems ?? []).map((i) => {
        const unitPriceKurus =
          i.unitPriceKurus ?? Math.round(((i as unknown as { unitPrice?: number }).unitPrice ?? 0) * 100);
        const lineTotalKurus =
          i.lineTotalKurus ?? Math.round(((i as unknown as { lineTotal?: number }).lineTotal ?? 0) * 100);
        const unitCostKurus = i.unitCostKurus ?? 0;
        const lineCostKurus = i.lineCostKurus ?? i.qty * unitCostKurus;
        return {
          ...i,
          unitPriceKurus,
          lineTotalKurus,
          unitCostKurus,
          lineCostKurus
        };
      }),
      stockMovements: parsed.stockMovements ?? [],
      closures: (parsed.closures ?? []).map((c) => {
        const grossRevenueKurus =
          c.grossRevenueKurus ?? Math.round(((c as unknown as { grossRevenue?: number }).grossRevenue ?? 0) * 100);
        const costTotalKurus = c.costTotalKurus ?? 0;
        const profitKurus = c.profitKurus ?? grossRevenueKurus - costTotalKurus;
        return {
          ...c,
          cashTotalKurus: c.cashTotalKurus ?? Math.round(((c as unknown as { cashTotal?: number }).cashTotal ?? 0) * 100),
          cardTotalKurus: c.cardTotalKurus ?? Math.round(((c as unknown as { cardTotal?: number }).cardTotal ?? 0) * 100),
          grossRevenueKurus,
          costTotalKurus,
          profitKurus
        };
      }),
      settings: {
        openingTime: parsed.settings?.openingTime ?? "09:00",
        closureTime: parsed.settings?.closureTime ?? "23:00",
        lowStockThreshold: parsed.settings?.lowStockThreshold ?? 10,
        openingCashKurus: parsed.settings?.openingCashKurus ?? 0,
        openingCashDate: parsed.settings?.openingCashDate ?? ""
      },
      sequences: {
        productId: parsed.sequences?.productId ?? 0,
        saleId: parsed.sequences?.saleId ?? 0,
        saleItemId: parsed.sequences?.saleItemId ?? 0,
        stockMovementId: parsed.sequences?.stockMovementId ?? 0,
        closureId: parsed.sequences?.closureId ?? 0,
        categoryId: parsed.sequences?.categoryId ?? 0
      }
    };
  }

  save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
  }

  getState() {
    return this.data;
  }
}
