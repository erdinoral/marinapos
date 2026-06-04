import type { CategorySaleUnit, Product, StockAddInput, StockCostMode } from "../../types/models";
import { parseTrAmount, tlToKurus } from "../../utils/currency";
import { incomingCostTlToUnitCostKurus, kurusPerGramToTlPer1000g } from "../../utils/saleUnit";

export function defaultCostTlForProduct(p: Product, unit: CategorySaleUnit): string {
  const cost = p.costPriceKurus ?? 0;
  if (cost <= 0) return "";
  return unit === "gram" ? kurusPerGramToTlPer1000g(cost).toFixed(2) : (cost / 100).toFixed(2);
}

function applyRemainingDebtToInput(input: StockAddInput, remainingDebtTl: string): boolean {
  const trimmed = String(remainingDebtTl ?? "").trim();
  if (trimmed === "") return true;
  const d = parseTrAmount(trimmed);
  if (d == null || d < 0) {
    window.alert("Kalan borc (TL) gecersiz.");
    return false;
  }
  if (d === 0) return true;
  input.remainingDebtKurus = tlToKurus(d);
  return true;
}

export function buildStockAddInput(
  product: Product,
  unit: CategorySaleUnit,
  costMode: StockCostMode,
  costTl: string,
  invoicePaidTl: string,
  remainingDebtTl: string,
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
    if (!applyRemainingDebtToInput(input, remainingDebtTl)) return null;
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
  if (!applyRemainingDebtToInput(input, remainingDebtTl)) return null;
  return input;
}
