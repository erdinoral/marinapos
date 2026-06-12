import type { Category, CategorySaleUnit, Product, StockCostLayer } from "../types/models";
import { normalizeGramCartQty } from "./saleUnit";
import { lineCostKurusFromUnit, unitCostKurusFromInvoicePaid } from "./stockCost";

export type FifoStateSlice = {
  stockCostLayers: StockCostLayer[];
  sequences: { stockCostLayerId: number };
  products: Product[];
  categories: Category[];
};

export function orderedLayersForProduct(state: FifoStateSlice, productId: number): StockCostLayer[] {
  return state.stockCostLayers
    .filter((l) => l.productId === productId && l.qtyRemaining > 0)
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
}

/** Satista kullanilacak birim maliyet: en eski kalan parti */
export function activeFifoUnitCostKurus(state: FifoStateSlice, productId: number): number {
  const head = orderedLayersForProduct(state, productId)[0];
  return head?.unitCostKurus ?? 0;
}

export function syncProductCostFromFifo(state: FifoStateSlice, productId: number): void {
  const p = state.products.find((x) => x.id === productId);
  if (!p) return;
  const head = activeFifoUnitCostKurus(state, productId);
  if (head > 0) p.costPriceKurus = head;
}

/** Gelen stoktan FIFO'ya yazilacak miktar: once eksiye dusen satis borcu kapanir */
export function fifoQtyForStockAdd(stockBefore: number, addQty: number, saleUnit: CategorySaleUnit): number {
  const add = saleUnit === "gram" ? Math.max(0, Math.round(addQty)) : Math.max(0, Math.round(addQty));
  if (add <= 0) return 0;
  const before = saleUnit === "gram" ? Math.round(stockBefore) : Math.round(stockBefore);
  const after = before + add;
  return Math.max(0, after) - Math.max(0, before);
}

/** Stok girisi: sondaki parti ile ayni birim fiyat ise birlestir; degilse yeni parti */
export function pushFifoLayer(
  state: FifoStateSlice,
  productId: number,
  qty: number,
  unitCostKurus: number,
  saleUnit: CategorySaleUnit,
  stockMovementId?: number
): void {
  const q = saleUnit === "gram" ? normalizeGramCartQty(qty) : Math.max(0, Math.round(qty));
  const unit = Math.max(0, Math.round(unitCostKurus));
  if (q <= 0 || unit <= 0) return;

  const allForProduct = state.stockCostLayers
    .filter((l) => l.productId === productId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  const last = allForProduct[allForProduct.length - 1];

  if (last && last.qtyRemaining > 0 && last.unitCostKurus === unit) {
    last.qtyRemaining += q;
  } else {
    state.sequences.stockCostLayerId += 1;
    state.stockCostLayers.push({
      id: state.sequences.stockCostLayerId,
      productId,
      qtyRemaining: q,
      unitCostKurus: unit,
      createdAt: new Date().toISOString(),
      ...(stockMovementId != null && stockMovementId > 0 ? { stockMovementId } : {})
    });
  }
  syncProductCostFromFifo(state, productId);
}

/** Satis: en eski partilerden dus; satir maliyeti ve kayit birim maliyeti */
export function consumeFifo(
  state: FifoStateSlice,
  productId: number,
  qty: number,
  saleUnit: CategorySaleUnit
): { lineCostKurus: number; unitCostKurus: number } {
  const lineQty = saleUnit === "gram" ? normalizeGramCartQty(qty) : Math.max(0, Math.round(qty));
  if (lineQty <= 0) return { lineCostKurus: 0, unitCostKurus: 0 };

  let remaining = lineQty;
  let totalCost = 0;
  const ordered = orderedLayersForProduct(state, productId);

  for (const layer of ordered) {
    if (remaining <= 0) break;
    const take = Math.min(layer.qtyRemaining, remaining);
    totalCost += lineCostKurusFromUnit(layer.unitCostKurus, take, saleUnit);
    layer.qtyRemaining -= take;
    remaining -= take;
  }

  if (remaining > 0) {
    const p = state.products.find((x) => x.id === productId);
    const fallback =
      activeFifoUnitCostKurus(state, productId) ||
      p?.costPriceKurus ||
      ordered[ordered.length - 1]?.unitCostKurus ||
      0;
    totalCost += lineCostKurusFromUnit(fallback, remaining, saleUnit);
  }

  state.stockCostLayers = state.stockCostLayers.filter((l) => !(l.productId === productId && l.qtyRemaining <= 0));
  syncProductCostFromFifo(state, productId);

  const unitCostKurus =
    saleUnit === "gram"
      ? unitCostKurusFromInvoicePaid(totalCost, lineQty, "gram")
      : lineQty > 0
        ? Math.round(totalCost / lineQty)
        : 0;

  return { lineCostKurus: totalCost, unitCostKurus };
}

/** Iade: iade birim maliyeti ile stoga geri (sona ekle; ayni fiyat varsa birlestir) */
export function restoreFifoOnReturn(
  state: FifoStateSlice,
  productId: number,
  qty: number,
  unitCostKurus: number,
  saleUnit: CategorySaleUnit
): void {
  pushFifoLayer(state, productId, qty, unitCostKurus, saleUnit);
}

/** Sayim duzeltme: katmanlari tek partiye indir (mevcut FIFO basi fiyat) */
export function resetFifoLayersToQty(
  state: FifoStateSlice,
  productId: number,
  qty: number,
  unitCostKurus: number,
  saleUnit: CategorySaleUnit
): void {
  state.stockCostLayers = state.stockCostLayers.filter((l) => l.productId !== productId);
  const q = saleUnit === "gram" ? Math.max(0, Math.round(qty)) : Math.max(0, Math.round(qty));
  const unit = Math.max(0, Math.round(unitCostKurus));
  if (q > 0 && unit > 0) {
    state.sequences.stockCostLayerId += 1;
    state.stockCostLayers.push({
      id: state.sequences.stockCostLayerId,
      productId,
      qtyRemaining: q,
      unitCostKurus: unit,
      createdAt: new Date().toISOString()
    });
  }
  syncProductCostFromFifo(state, productId);
}

/** Eldeki stogun toplam maliyet degeri (tum partiler) */
export function inventoryCostFromLayers(
  layers: StockCostLayer[],
  productId: number,
  saleUnit: CategorySaleUnit
): number {
  let sum = 0;
  for (const l of layers) {
    if (l.productId !== productId || l.qtyRemaining <= 0) continue;
    sum += lineCostKurusFromUnit(l.unitCostKurus, l.qtyRemaining, saleUnit);
  }
  return sum;
}

/** Stok girisi silme: once ilgili parti, sonra ayni urunun en yeni katmanlarindan (LIFO) dus */
export function reverseStockAddFifo(
  state: FifoStateSlice,
  productId: number,
  qty: number,
  saleUnit: CategorySaleUnit,
  stockMovementId?: number
): void {
  const need = saleUnit === "gram" ? Math.max(0, Math.round(qty)) : Math.max(0, Math.round(qty));
  if (need <= 0) return;

  let remaining = need;

  if (stockMovementId != null && stockMovementId > 0) {
    for (const layer of state.stockCostLayers.filter((l) => l.productId === productId && l.stockMovementId === stockMovementId)) {
      if (remaining <= 0) break;
      const take = Math.min(layer.qtyRemaining, remaining);
      layer.qtyRemaining -= take;
      remaining -= take;
    }
  }

  if (remaining > 0) {
    const newestFirst = state.stockCostLayers
      .filter((l) => l.productId === productId && l.qtyRemaining > 0)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
    for (const layer of newestFirst) {
      if (remaining <= 0) break;
      const take = Math.min(layer.qtyRemaining, remaining);
      layer.qtyRemaining -= take;
      remaining -= take;
    }
  }

  if (remaining > 0) {
    throw new Error("Bu girisin stogu satis veya baska islemle tuketilmis; silinemez.");
  }

  state.stockCostLayers = state.stockCostLayers.filter((l) => !(l.productId === productId && l.qtyRemaining <= 0));
  syncProductCostFromFifo(state, productId);
}

/** Mevcut veri: partisi yoksa tek katman olustur */
export function migrateFifoLayersForProducts(state: FifoStateSlice): void {
  if (!state.stockCostLayers) state.stockCostLayers = [];
  if (!state.sequences.stockCostLayerId) state.sequences.stockCostLayerId = 0;

  const maxId = state.stockCostLayers.reduce((m, l) => Math.max(m, l.id), 0);
  state.sequences.stockCostLayerId = Math.max(state.sequences.stockCostLayerId, maxId);

  for (const p of state.products) {
    if (p.stockQty <= 0) {
      state.stockCostLayers = state.stockCostLayers.filter((l) => l.productId !== p.id);
      continue;
    }
    const layers = state.stockCostLayers.filter((l) => l.productId === p.id && l.qtyRemaining > 0);
    const sum = layers.reduce((s, l) => s + l.qtyRemaining, 0);
    if (layers.length === 0) {
      const unit = Math.max(0, Math.round(p.costPriceKurus ?? 0));
      if (unit > 0) {
        state.sequences.stockCostLayerId += 1;
        state.stockCostLayers.push({
          id: state.sequences.stockCostLayerId,
          productId: p.id,
          qtyRemaining: p.stockQty,
          unitCostKurus: unit,
          createdAt: new Date().toISOString()
        });
      }
      continue;
    }
    if (sum !== p.stockQty) {
      const unit = activeFifoUnitCostKurus(state, p.id) || Math.max(0, Math.round(p.costPriceKurus ?? 0));
      const cat = state.categories.find((c) => c.id === p.categoryId);
      const saleUnit = cat?.saleUnit === "gram" ? "gram" : "piece";
      resetFifoLayersToQty(state, p.id, p.stockQty, unit, saleUnit);
    } else {
      syncProductCostFromFifo(state, p.id);
    }
  }
}
