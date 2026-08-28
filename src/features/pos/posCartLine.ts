import type { Category, Product, SaleLineInput } from "../../types/models";
import { formatTry, kurusToTl, tlToKurus } from "../../utils/currency";
import {
  categorySaleUnitOf,
  formatTlPer1000g,
  gramLineTotalKurus,
  gramLineTotalTl,
  gramPriceKurusMigrate,
  gramsFromWholeLineTotalTl,
  kurusPerGramToTlPer1000g,
  normalizeGramCartQty,
  tlPer1000gToKurusPerGram
} from "../../utils/saleUnit";
import { effectiveProductCostKurus, effectiveProductPriceKurus, getCachedUsdTry } from "../../utils/usdPricing";

export type CartPriceSource = "retail" | "wholesale" | "alternate";

export type PosCartLine = Product & {
  qty: number;
  priceSource: CartPriceSource;
  /** Elle birim fiyat (kurus); null = kaynaga gore */
  manualUnitPriceKurus: number | null;
  /** Gram: tartili satista elle gelis kurus/gram; null = urun karti maliyeti */
  manualUnitCostKurus: number | null;
  /** Urun indirimine ek satir indirimi % */
  lineExtraDiscountPercent: number;
  /** Gram: tutar alanindan girilen tam TL; gram buna gore hesaplanir, TL sabit kalir */
  manualLineTotalTlWhole: number | null;
};

/** Katalog / sepet satiri icin guncel TL birim (dolar urunde kurdan) */
export function liveRetailUnitKurus(p: Pick<Product, "pricedInUsd" | "priceUsdCents" | "priceKurus">): number {
  return effectiveProductPriceKurus(p, getCachedUsdTry());
}

export function liveCostUnitKurus(p: Pick<Product, "pricedInUsd" | "costUsdCents" | "costPriceKurus">): number {
  return effectiveProductCostKurus(p, getCachedUsdTry());
}

export function baseUnitKurusFromSource(p: PosCartLine, useCardListPrice = false): number {
  if (p.manualUnitPriceKurus != null) return p.manualUnitPriceKurus;
  /** Sepette Toptan seciliyse odeme Kart olsa bile kart fiyati toptani ezmesin */
  if (p.priceSource === "wholesale") {
    return p.wholesalePriceKurus > 0 ? p.wholesalePriceKurus : liveRetailUnitKurus(p);
  }
  if (useCardListPrice && p.alternatePriceKurus > 0) return p.alternatePriceKurus;
  if (p.priceSource === "alternate") return p.alternatePriceKurus > 0 ? p.alternatePriceKurus : liveRetailUnitKurus(p);
  return liveRetailUnitKurus(p);
}

/** Urun karti + musteri indirimi (birim fiyata) */
function unitDiscountFactor(p: PosCartLine, customerLineDiscountPercent = 0): number {
  const skipProductDiscount = p.manualUnitPriceKurus != null || p.priceSource === "wholesale";
  const d1 = skipProductDiscount ? 0 : Math.max(0, Math.min(100, Number(p.discountPercent ?? 0)));
  const d3 = Math.max(0, Math.min(100, Number(customerLineDiscountPercent ?? 0)));
  return ((100 - d1) / 100) * ((100 - d3) / 100);
}

/** Sepet satir Ind.% — birim fiyata degil, satir toplamina uygulanir */
export function lineExtraDiscountFactor(p: PosCartLine): number {
  const d2 = Math.max(0, Math.min(100, Number(p.lineExtraDiscountPercent ?? 0)));
  return (100 - d2) / 100;
}

/** Gram: satir tutari = (TL / 1000 g × gram) / 1000 */
export function gramCartLineTotalTl(tlPer1000g: number, grams: number): number {
  return gramLineTotalTl(tlPer1000g, grams);
}

/** Gram: birim fiyat TL / 1000 g (satir Ind.% birimden dusulmez) */
export function effectiveTlPer1000gForLine(
  p: PosCartLine,
  customerLineDiscountPercent = 0,
  useCardListPrice = false
): number {
  const baseTl = kurusPerGramToTlPer1000g(baseUnitKurusFromSource(p, useCardListPrice));
  return Math.round(baseTl * unitDiscountFactor(p, customerLineDiscountPercent) * 100) / 100;
}

/** Gram: Ind.% oncesi satir tutari TL */
export function gramBaseLineTotalTlForCart(
  line: PosCartLine,
  categories: Category[],
  customerLineDiscountPercent = 0,
  useCardListPrice = false
): number {
  if (categorySaleUnitOf(categories, line.categoryId) !== "gram") return 0;
  if (line.manualLineTotalTlWhole != null && line.manualLineTotalTlWhole > 0) {
    return line.manualLineTotalTlWhole;
  }
  return gramLineTotalTl(
    effectiveTlPer1000gForLine(line, customerLineDiscountPercent, useCardListPrice),
    normalizeGramCartQty(line.qty)
  );
}

/**
 * Liste / sepet birim fiyati (kurus).
 * Adet ve gramda satir Ind.% birime uygulanmaz — toplamdan dusulur.
 */
export function effectiveUnitKurusForLine(
  p: PosCartLine,
  customerLineDiscountPercent = 0,
  useCardListPrice = false,
  categories?: Category[]
): number {
  const isGram = categories ? categorySaleUnitOf(categories, p.categoryId) === "gram" : false;
  if (isGram) {
    return tlPer1000gToKurusPerGram(effectiveTlPer1000gForLine(p, customerLineDiscountPercent, useCardListPrice));
  }
  const base = baseUnitKurusFromSource(p, useCardListPrice);
  return Math.round(base * unitDiscountFactor(p, customerLineDiscountPercent));
}

/** Liste birim fiyati: adet = kurus/adet; gram = paket kurus (1000 g) */
export function formatPosUnitPrice(unitKurus: number, categories: Category[], categoryId: number): string {
  if (categorySaleUnitOf(categories, categoryId) === "gram") {
    return formatTlPer1000g(unitKurus);
  }
  return formatTry(unitKurus);
}

/** Gram satir: tutardan gram (stok ust sinirli) */
export function gramsFromLineTotalKurus(totalKurus: number, packageKurusPer1000g: number, maxStockGram: number): number | null {
  const tlPer1000 = kurusPerGramToTlPer1000g(packageKurusPer1000g);
  return gramsFromWholeLineTotalTl(Math.round(kurusToTl(totalKurus)), tlPer1000, maxStockGram);
}

/** Sabit tam TL'den gram yeniden hesapla (indirim / birim degisince) */
export function recalcGramQtyFromFixedTl(
  line: PosCartLine,
  totalTlWhole: number,
  customerLineDiscountPercent = 0,
  useCardListPrice = false
): number | null {
  const tlPer1000 = effectiveTlPer1000gForLine(line, customerLineDiscountPercent, useCardListPrice);
  return gramsFromWholeLineTotalTl(totalTlWhole, tlPer1000);
}

/** Satir tutari TL — Ind.% toplamdan dusulur, birim sabit kalir */
export function lineTotalTlForCart(
  line: PosCartLine,
  categories: Category[],
  customerLineDiscountPercent = 0,
  useCardListPrice = false
): number {
  const unit = categorySaleUnitOf(categories, line.categoryId);
  if (unit === "gram") {
    const base = gramBaseLineTotalTlForCart(line, categories, customerLineDiscountPercent, useCardListPrice);
    return Math.round(base * lineExtraDiscountFactor(line) * 100) / 100;
  }
  const unitKurus = effectiveUnitKurusForLine(line, customerLineDiscountPercent, useCardListPrice, categories);
  const baseKurus = Math.round(unitKurus * line.qty);
  return kurusToTl(Math.round(baseKurus * lineExtraDiscountFactor(line)));
}

/** Satir tutari kurus (gram hesabi TL uzerinden) */
export function lineTotalKurusForCart(
  line: PosCartLine,
  categories: Category[],
  customerLineDiscountPercent = 0,
  useCardListPrice = false
): number {
  const unit = categorySaleUnitOf(categories, line.categoryId);
  if (unit === "gram") return tlToKurus(lineTotalTlForCart(line, categories, customerLineDiscountPercent, useCardListPrice));
  const unitKurus = effectiveUnitKurusForLine(line, customerLineDiscountPercent, useCardListPrice, categories);
  return Math.round(Math.round(unitKurus * line.qty) * lineExtraDiscountFactor(line));
}

export function lineToSaleInput(
  line: PosCartLine,
  categories: Category[],
  customerLineDiscountPercent = 0,
  useCardListPrice = false
): SaleLineInput {
  const unit = categorySaleUnitOf(categories, line.categoryId);
  const qty = unit === "gram" ? normalizeGramCartQty(line.qty) : Math.round(line.qty);
  const unitPriceKurus = effectiveUnitKurusForLine(line, customerLineDiscountPercent, useCardListPrice, categories);
  const lineTotalKurus = lineTotalKurusForCart(line, categories, customerLineDiscountPercent, useCardListPrice);
  if (unit === "gram") {
    const cost = line.manualUnitCostKurus ?? liveCostUnitKurus(line);
    return {
      productId: line.id,
      qty,
      unitPriceKurus,
      unitCostKurus: Math.max(0, Math.round(Number(cost) || 0)),
      lineTotalKurus
    };
  }
  return { productId: line.id, qty, unitPriceKurus, lineTotalKurus };
}

export function newLineFromProduct(product: Product, qty: number, priceSource: CartPriceSource): PosCartLine {
  return {
    ...product,
    qty,
    priceSource,
    manualUnitPriceKurus: null,
    manualUnitCostKurus: null,
    lineExtraDiscountPercent: 0,
    manualLineTotalTlWhole: null
  };
}

function mergeCartLinesByProductAndSource(items: PosCartLine[], categories: Category[]): PosCartLine[] {
  const merged: PosCartLine[] = [];
  const indexByKey = new Map<string, number>();

  for (const item of items) {
    const key = `${item.id}-${item.priceSource}`;
    const idx = indexByKey.get(key);
    if (idx == null) {
      indexByKey.set(key, merged.length);
      merged.push(item);
      continue;
    }
    const existing = merged[idx];
    const unit = categorySaleUnitOf(categories, item.categoryId);
    if (unit === "gram") {
      merged[idx] = {
        ...existing,
        qty: normalizeGramCartQty(existing.qty + item.qty),
        manualLineTotalTlWhole: null
      };
    } else {
      merged[idx] = {
        ...existing,
        qty: Math.max(0, Math.round(existing.qty + item.qty))
      };
    }
  }

  return merged;
}

/** Perakende / toptan gecisinde mevcut sepet satirlarini yeni fiyat kaynagina cevirir */
export function convertCartItemsPriceMode(
  items: PosCartLine[],
  targetSource: Extract<CartPriceSource, "retail" | "wholesale">,
  categories: Category[],
  customerCustomPricesByProduct: Record<number, number>,
  customerLineDiscountPercent = 0,
  useCardListPrice = false
): PosCartLine[] {
  const converted = items.map((item) => {
    if (item.priceSource === "alternate") return item;
    if (item.priceSource === targetSource) return item;

    const unit = categorySaleUnitOf(categories, item.categoryId);
    let next: PosCartLine = {
      ...item,
      priceSource: targetSource,
      manualUnitPriceKurus: null
    };

    if (targetSource === "retail") {
      const customKurus = customerCustomPricesByProduct[item.id];
      if (customKurus != null && customKurus > 0) {
        next.manualUnitPriceKurus = unit === "gram" ? gramPriceKurusMigrate(customKurus) : customKurus;
      }
    }

    if (next.manualLineTotalTlWhole != null && next.manualLineTotalTlWhole > 0) {
      const grams = recalcGramQtyFromFixedTl(next, next.manualLineTotalTlWhole, customerLineDiscountPercent, useCardListPrice);
      if (grams != null) next = { ...next, qty: grams };
    }

    return next;
  });

  return mergeCartLinesByProductAndSource(converted, categories);
}
