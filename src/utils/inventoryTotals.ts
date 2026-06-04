import type { Category, CategorySaleUnit, Product, StockCostLayer } from "../types/models";
import { inventoryCostFromLayers } from "./fifoStockCost";
import { categorySaleUnitOf, inventoryCostKurus, inventoryRevenueKurus } from "./saleUnit";

export type InventoryTotals = {
  skuCount: number;
  costKurus: number;
  revenueKurus: number;
  profitKurus: number;
};

export function lineInventoryCostKurus(p: Product, unit: CategorySaleUnit, layers: StockCostLayer[]): number {
  const fromFifo = inventoryCostFromLayers(layers, p.id, unit);
  if (fromFifo > 0) return fromFifo;
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
