import type { CategorySaleUnit, Product, StockAddInput, StockCostMode } from "../../types/models";
import { parseTrAmount, tlToKurus } from "../../utils/currency";
import { computeStockAddCosts } from "../../utils/stockCost";
import { incomingCostTlToUnitCostKurus, kurusPerGramToTlPer1000g } from "../../utils/saleUnit";
import { resolveLinePaymentFromPaidTl } from "./linePaidTl";

export function defaultCostTlForProduct(p: Product, unit: CategorySaleUnit): string {
  const cost = p.costPriceKurus ?? 0;
  if (cost <= 0) return "";
  return unit === "gram" ? kurusPerGramToTlPer1000g(cost).toFixed(2) : (cost / 100).toFixed(2);
}

function lineCostKurusForInput(
  product: Product,
  unit: CategorySaleUnit,
  qty: number,
  costMode: StockCostMode,
  costTl: string,
  invoicePaidTl: string
): number | null {
  const q = Math.max(0, Math.round(qty));
  if (q <= 0) return null;
  let unitCatalogKurus = Math.max(0, Math.round(Number(product.costPriceKurus ?? 0)));
  const trimmed = String(costTl ?? "").trim();
  if (trimmed !== "") {
    const parsed = incomingCostTlToUnitCostKurus(costTl, unit);
    if (parsed === null) return null;
    if (parsed !== undefined) unitCatalogKurus = parsed;
  }
  let invoicePaidKurus: number | undefined;
  if (costMode === "invoice") {
    const paid = parseTrAmount(String(invoicePaidTl ?? "").trim());
    if (paid == null || paid <= 0) return null;
    invoicePaidKurus = tlToKurus(paid);
  } else if (unitCatalogKurus <= 0) {
    return null;
  }
  try {
    return computeStockAddCosts({
      costMode,
      qty: q,
      saleUnit: unit,
      unitCatalogKurus,
      invoicePaidKurus
    }).lineCostKurus;
  } catch {
    return null;
  }
}

function applyLinePaidToInput(input: StockAddInput, linePaidTl: string, lineCostKurus: number): boolean {
  const payment = resolveLinePaymentFromPaidTl(linePaidTl, lineCostKurus);
  if (!payment) return false;
  if (payment.remainingDebtKurus > 0) {
    input.remainingDebtKurus = payment.remainingDebtKurus;
  }
  return true;
}

export function buildStockAddInput(
  product: Product,
  unit: CategorySaleUnit,
  qty: number,
  costMode: StockCostMode,
  costTl: string,
  invoicePaidTl: string,
  linePaidTl: string,
  supplierId: number
): StockAddInput | null {
  if (supplierId <= 0) {
    window.alert("Tedarikci secin. Gelis kaydi ilgili tedarikci gecmisine yazilir.");
    return null;
  }
  const input: StockAddInput = { supplierId, costMode, recordExpense: true };

  if (costMode === "invoice") {
    const paid = parseTrAmount(String(invoicePaidTl ?? "").trim());
    if (paid == null || paid <= 0) {
      window.alert("Odenen fatura tutari (TL) girin.");
      return null;
    }
    input.invoicePaidKurus = tlToKurus(paid);
    const trimmed = String(costTl ?? "").trim();
    if (trimmed !== "") {
      const parsed = incomingCostTlToUnitCostKurus(costTl, unit);
      if (parsed === null) {
        window.alert("Referans birim gelis (TL) gecersiz.");
        return null;
      }
      if (parsed !== undefined) input.unitCostKurus = parsed;
    }
    const lineCostKurus = lineCostKurusForInput(product, unit, qty, costMode, costTl, invoicePaidTl);
    if (lineCostKurus == null) return null;
    if (!applyLinePaidToInput(input, linePaidTl, lineCostKurus)) return null;
    return input;
  }

  const trimmed = String(costTl ?? "").trim();
  if (trimmed !== "") {
    const parsed = incomingCostTlToUnitCostKurus(costTl, unit);
    if (parsed === null) {
      window.alert("Birim gelis (TL) gecersiz.");
      return null;
    }
    if (parsed === undefined) {
      window.alert("Birim gelis (TL) girin.");
      return null;
    }
    input.unitCostKurus = parsed;
  } else if ((product.costPriceKurus ?? 0) <= 0) {
    window.alert("Birim gelis (TL) girin veya urun kartinda maliyet tanimlayin.");
    return null;
  }
  const lineCostKurus = lineCostKurusForInput(product, unit, qty, costMode, costTl, invoicePaidTl);
  if (lineCostKurus == null) return null;
  if (!applyLinePaidToInput(input, linePaidTl, lineCostKurus)) return null;
  return input;
}
