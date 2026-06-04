import type { CategorySaleUnit, StockCostMode } from "../types/models";
import { gramLineTotalKurus, kurusPerGramToTlPer1000g } from "./saleUnit";

export function lineCostKurusFromUnit(unitCostKurus: number, qty: number, saleUnit: CategorySaleUnit): number {
  const unit = Math.max(0, Math.round(unitCostKurus));
  const q = Math.max(0, Math.round(qty));
  if (unit <= 0 || q <= 0) return 0;
  if (saleUnit === "gram") return gramLineTotalKurus(unit, q);
  return Math.round(unit * q);
}

/** Fatura odemesine gore urun karti agirlikli ortalama birim maliyeti */
export function unitCostKurusFromInvoicePaid(invoicePaidKurus: number, qty: number, saleUnit: CategorySaleUnit): number {
  const paid = Math.max(0, Math.round(invoicePaidKurus));
  const q = Math.max(1, Math.round(qty));
  if (paid <= 0) return 0;
  if (saleUnit === "gram") {
    return Math.round((paid * 1000) / q);
  }
  return Math.round(paid / q);
}

export function computeStockAddCosts(input: {
  costMode: StockCostMode;
  qty: number;
  saleUnit: CategorySaleUnit;
  unitCatalogKurus: number;
  invoicePaidKurus?: number;
}): { unitCostRecorded: number; lineCostKurus: number; catalogLineCostKurus: number } {
  const catalogLineCostKurus = lineCostKurusFromUnit(input.unitCatalogKurus, input.qty, input.saleUnit);

  if (input.costMode === "invoice") {
    const paid = Math.max(0, Math.round(Number(input.invoicePaidKurus ?? 0)));
    if (paid <= 0) {
      throw new Error("Odenen fatura tutari gerekli.");
    }
    return {
      catalogLineCostKurus,
      lineCostKurus: paid,
      unitCostRecorded: unitCostKurusFromInvoicePaid(paid, input.qty, input.saleUnit)
    };
  }

  const unit = Math.max(0, Math.round(input.unitCatalogKurus));
  if (unit <= 0) {
    throw new Error("Birim gelis (TL) girin veya urun kartinda maliyet tanimlayin.");
  }
  return {
    unitCostRecorded: unit,
    catalogLineCostKurus,
    lineCostKurus: catalogLineCostKurus
  };
}

export function stockCostModeLabel(mode: StockCostMode): string {
  return mode === "invoice" ? "Odenen fatura" : "Urun bazli";
}

/** Stok girisi kaydindan birim gelis (kurus); eski kayitlarda yalnizca satir toplami olabilir */
export function resolveStockEntryUnitCostKurus(
  row: {
    unitCostKurus?: number;
    lineCostKurus?: number;
    invoicePaidKurus?: number;
    qty: number;
  },
  saleUnit: CategorySaleUnit
): number | undefined {
  if (row.unitCostKurus != null && row.unitCostKurus > 0) return row.unitCostKurus;
  const q = Math.max(0, Math.round(row.qty));
  if (q <= 0) return undefined;
  if (row.lineCostKurus != null && row.lineCostKurus > 0) {
    return unitCostKurusFromInvoicePaid(row.lineCostKurus, q, saleUnit);
  }
  if (row.invoicePaidKurus != null && row.invoicePaidKurus > 0) {
    return unitCostKurusFromInvoicePaid(row.invoicePaidKurus, q, saleUnit);
  }
  return undefined;
}
