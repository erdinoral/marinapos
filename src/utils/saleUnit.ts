import type { Category, CategorySaleUnit, Product } from "../types/models";
import { formatTl, kurusToTl, tlToKurus } from "./currency";

export function normalizeCategorySaleUnit(u: unknown): CategorySaleUnit {
  return u === "gram" ? "gram" : "piece";
}

export function categorySaleUnitOf(categories: Category[], categoryId: number): CategorySaleUnit {
  const c = categories.find((x) => x.id === categoryId);
  return c?.saleUnit ?? "piece";
}

/** Stok / eksik listesi: gram kategorilerde stok tutulmaz (daima disarida) */
export function lowStockQtyLimit(categories: Category[], categoryId: number, lowStockThreshold: number): number {
  return categorySaleUnitOf(categories, categoryId) === "gram" ? 1000 : lowStockThreshold;
}

export function isProductLowStock(
  product: Pick<Product, "stockQty" | "categoryId" | "isActive">,
  categories: Category[],
  lowStockThreshold: number
): boolean {
  if (product.isActive !== 1) return false;
  if (categorySaleUnitOf(categories, product.categoryId) === "gram") return false;
  const limit = lowStockQtyLimit(categories, product.categoryId, lowStockThreshold);
  return product.stockQty < limit;
}

/** Kisa metin: "12 adet" / "250 g" (gram tam sayi) */
export function formatQtyShort(qty: number, unit: CategorySaleUnit): string {
  if (unit === "gram") {
    return `${Math.max(0, Math.round(qty))} g`;
  }
  const n = Math.round(qty);
  return `${n} adet`;
}

/** Sepet / satis: gram tam sayi, en az 1 */
export function normalizeGramQty(grams: number): number {
  return Math.max(1, Math.round(Number(grams) || 0));
}

/** Stok / sayim: gram tam sayi, 0 veya pozitif */
export function normalizeGramStockQty(grams: number): number {
  return Math.max(0, Math.round(Number(grams) || 0));
}

/** Gram urun sepete ilk eklenince: 1000 g (1 kg), stok yetmiyorsa stok kadar */
export function defaultGramQtyForCart(stockQty: number): number {
  const stock = normalizeGramStockQty(stockQty);
  if (stock >= 1000) return 1000;
  if (stock >= 1) return stock;
  return 1000;
}

/** POS / etiket: "5 adet kaldi" / "250 g kaldi" */
export function formatLowStockRemainLabel(product: Pick<Product, "stockQty" | "categoryId">, categories: Category[]): string {
  const unit = categorySaleUnitOf(categories, product.categoryId);
  return `${formatQtyShort(product.stockQty, unit)} kaldi`;
}

export function pricePlaceholder(unit: CategorySaleUnit): string {
  return unit === "gram" ? "Satis fiyati (TL / 1000 g)" : "Satis fiyati (TL / adet)";
}

export function wholesalePricePlaceholder(unit: CategorySaleUnit): string {
  return unit === "gram" ? "Toptan fiyat (TL / 1000 g)" : "Toptan fiyat (TL / adet)";
}

export function costPlaceholder(unit: CategorySaleUnit): string {
  return unit === "gram" ? "Gelis (TL / 1000 g)" : "Gelis / maliyet (TL) birim";
}

/**
 * Gram urunlerde DB priceKurus (ve sepet ozel fiyat) = 1000 g paketinin toplam kurus tutari.
 * Eski kayitlar kurus/gram sakliyordu (< 1000); yuklemede gramPriceKurusMigrate ile donusturulur.
 */
export function gramPriceKurusMigrate(kurus: number): number {
  const k = Math.max(0, Math.round(Number(kurus) || 0));
  if (k <= 0) return 0;
  if (k < 1000) return k * 1000;
  return k;
}

/** TL / 1000 g -> DB (1000 g paket kurus) */
export function tlPer1000gToKurusPerGram(tlPer1000g: number): number {
  return tlToKurus(tlPer1000g);
}

/** @deprecated Ad; gram icin tlPer1000gToKurusPerGram kullanin — ayni deger doner */
export const tlPer1000gToPriceKurus = tlPer1000gToKurusPerGram;

export function costTlPer1000gToCostPriceKurus(costTlPer1000g: number): number {
  return tlPer1000gToKurusPerGram(costTlPer1000g);
}

/** DB gram fiyat (1000 g kurus) -> TL / 1000 g */
export function kurusPerGramToTlPer1000g(storedKurus: number): number {
  return kurusToTl(gramPriceKurusMigrate(storedKurus));
}

export function priceKurusToTlPer1000g(storedKurus: number): number {
  return kurusPerGramToTlPer1000g(storedKurus);
}

/** Gram urun: TL / 1000 g gosterimi */
export function formatTlPer1000g(storedKurus: number): string {
  return `${formatTl(priceKurusToTlPer1000g(storedKurus))} / 1000 g`;
}

/** Gram satir tutari TL: (TL/1000g × gram) / 1000, 2 ondalik; gram tam sayi */
export function gramLineTotalTl(tlPer1000g: number, grams: number): number {
  const u = Math.max(0, Number(tlPer1000g) || 0);
  const g = normalizeGramQty(grams);
  if (u <= 0 || g <= 0) return 0;
  return Math.round(((u * g) / 1000) * 100) / 100;
}

/** Tutar TL -> gram (tam sayi); maxStockGram verilirse stok ust sinirlanir */
export function gramsFromLineTotalTl(totalTl: number, tlPer1000g: number, maxStockGram?: number): number | null {
  if (tlPer1000g <= 0 || totalTl <= 0) return null;
  const grams = Math.round((totalTl * 1000) / tlPer1000g);
  const g = Math.max(1, grams);
  if (maxStockGram != null && maxStockGram >= 1) {
    const max = Math.max(1, Math.round(maxStockGram));
    return Math.min(g, max);
  }
  return g;
}

/** Depolama/kurus alanlari icin; hesap tamamen TL uzerinden yapilir */
export function gramLineTotalKurus(packageKurusPer1000g: number, grams: number): number {
  const tlPer1000 = kurusPerGramToTlPer1000g(packageKurusPer1000g);
  return tlToKurus(gramLineTotalTl(tlPer1000, grams));
}

/** Eldeki stogun maliyet degeri: adet = adet × birim; gram = (gram/1000) × 1000g paket fiyati */
export function inventoryCostKurus(
  product: Pick<Product, "stockQty" | "costPriceKurus">,
  unit: CategorySaleUnit
): number {
  const qty = unit === "gram" ? normalizeGramStockQty(product.stockQty) : Math.max(0, Math.round(Number(product.stockQty) || 0));
  const unitCost = Math.max(0, Math.round(Number(product.costPriceKurus) || 0));
  if (qty <= 0 || unitCost <= 0) return 0;
  if (unit === "gram") return gramLineTotalKurus(unitCost, qty);
  return Math.round(qty * unitCost);
}

/** Stok satilirsa tahmini ciro: adet × net birim; gram = (gram/1000) × 1000g net fiyat */
export function inventoryRevenueKurus(
  product: Pick<Product, "stockQty" | "priceKurus" | "discountPercent">,
  unit: CategorySaleUnit
): number {
  const qty = unit === "gram" ? normalizeGramStockQty(product.stockQty) : Math.max(0, Math.round(Number(product.stockQty) || 0));
  if (qty <= 0) return 0;
  const d = Math.max(0, Math.min(100, Number(product.discountPercent ?? 0)));
  const unitPrice = Math.round((product.priceKurus * (100 - d)) / 100);
  if (unitPrice <= 0) return 0;
  if (unit === "gram") return gramLineTotalKurus(unitPrice, qty);
  return Math.round(qty * unitPrice);
}

/**
 * Stok ekleme formu: TL metni -> birim gelis (kurus/adet veya gram paket kurus).
 * Bos metin: maliyet guncellenmez. Gecersiz sayi: null doner.
 */
export function incomingCostTlToUnitCostKurus(raw: string, unit: CategorySaleUnit): number | undefined | null {
  const s = String(raw ?? "").trim();
  if (s === "") return undefined;
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return unit === "gram" ? costTlPer1000gToCostPriceKurus(n) : tlToKurus(n);
}
