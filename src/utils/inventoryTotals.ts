import type { Category, CategorySaleUnit, Product, StockCostLayer } from "../types/models";
import { inventoryCostFromLayers } from "./fifoStockCost";
import { categorySaleUnitOf, inventoryCostKurus, inventoryRevenueKurus } from "./saleUnit";

export type InventoryTotals = {
  skuCount: number;
  costKurus: number;
  revenueKurus: number;
  profitKurus: number;
};

function fifoQtyRemaining(layers: StockCostLayer[], productId: number): number {
  let sum = 0;
  for (const l of layers) {
    if (l.productId !== productId || l.qtyRemaining <= 0) continue;
    sum += Math.round(Number(l.qtyRemaining) || 0);
  }
  return sum;
}

/**
 * Eldeki stok maliyeti — her zaman guncel stockQty ile orantili.
 * FIFO parti toplami stockQty'den sapmissa (satis/sayim sonrasi gecikmeli UI) tutar yine adede gore duserer.
 */
export function lineInventoryCostKurus(p: Product, unit: CategorySaleUnit, layers: StockCostLayer[]): number {
  const stockQty = Math.max(0, Math.round(Number(p.stockQty) || 0));
  if (stockQty <= 0) return 0;

  const fromFifo = inventoryCostFromLayers(layers, p.id, unit);
  const fifoQty = fifoQtyRemaining(layers, p.id);
  if (fromFifo > 0 && fifoQty > 0) {
    if (fifoQty === stockQty) return fromFifo;
    return Math.max(0, Math.round((fromFifo * stockQty) / fifoQty));
  }
  return inventoryCostKurus(p, unit);
}

export function computeInventoryTotals(
  productList: Product[],
  categories: Category[],
  costLayers: StockCostLayer[]
): InventoryTotals {
  let costKurus = 0;
  let revenueKurus = 0;
  for (const p of productList) {
    const unit = categorySaleUnitOf(categories, p.categoryId);
    costKurus += lineInventoryCostKurus(p, unit, costLayers);
    revenueKurus += inventoryRevenueKurus(p, unit);
  }
  return {
    skuCount: productList.length,
    costKurus,
    revenueKurus,
    profitKurus: revenueKurus - costKurus
  };
}
