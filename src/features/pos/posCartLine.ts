import type { Category, Product, SaleLineInput } from "../../types/models";
import { formatTry, kurusToTl, tlToKurus } from "../../utils/currency";
import {
  categorySaleUnitOf,
  formatTlPer1000g,
  gramLineTotalKurus,
  gramLineTotalTl,
  gramsFromLineTotalTl,
  kurusPerGramToTlPer1000g,
  normalizeGramQty,
  tlPer1000gToKurusPerGram
} from "../../utils/saleUnit";

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
};

export function baseUnitKurusFromSource(p: PosCartLine, useCardListPrice = false): number {
  if (p.manualUnitPriceKurus != null) return p.manualUnitPriceKurus;
  /** Sepette Toptan seciliyse odeme Kart olsa bile kart fiyati toptani ezmesin */
  if (p.priceSource === "wholesale") return p.wholesalePriceKurus > 0 ? p.wholesalePriceKurus : p.priceKurus;
  if (useCardListPrice && p.alternatePriceKurus > 0) return p.alternatePriceKurus;
  if (p.priceSource === "alternate") return p.alternatePriceKurus > 0 ? p.alternatePriceKurus : p.priceKurus;
  return p.priceKurus;
}

function discountFactor(p: PosCartLine, customerLineDiscountPercent = 0): number {
  /** Elle birim veya toptan satirda urun karti indirimi uygulanmaz */
  const skipProductDiscount = p.manualUnitPriceKurus != null || p.priceSource === "wholesale";
  const d1 = skipProductDiscount ? 0 : Math.max(0, Math.min(100, Number(p.discountPercent ?? 0)));
  const d2 = Math.max(0, Math.min(100, Number(p.lineExtraDiscountPercent ?? 0)));
  const d3 = Math.max(0, Math.min(100, Number(customerLineDiscountPercent ?? 0)));
  return ((100 - d1) / 100) * ((100 - d2) / 100) * ((100 - d3) / 100);
}

/** Gram: satir tutari = (TL / 1000 g × gram) / 1000 */
export function gramCartLineTotalTl(tlPer1000g: number, grams: number): number {
  return gramLineTotalTl(tlPer1000g, grams);
}

/** Gram: indirimli birim fiyat TL / 1000 g */
export function effectiveTlPer1000gForLine(
  p: PosCartLine,
  customerLineDiscountPercent = 0,
  useCardListPrice = false
): number {
  const baseTl = kurusPerGramToTlPer1000g(baseUnitKurusFromSource(p, useCardListPrice));
  return Math.round(baseTl * discountFactor(p, customerLineDiscountPercent) * 100) / 100;
}

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
  return Math.round(base * discountFactor(p, customerLineDiscountPercent));
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
  return gramsFromLineTotalTl(kurusToTl(totalKurus), tlPer1000, maxStockGram);
}

/** Gram satir tutari TL */
export function lineTotalTlForCart(
  line: PosCartLine,
  categories: Category[],
  customerLineDiscountPercent = 0,
  useCardListPrice = false
): number {
  const unit = categorySaleUnitOf(categories, line.categoryId);
  if (unit === "gram") {
    return Math.round(
      gramLineTotalTl(effectiveTlPer1000gForLine(line, customerLineDiscountPercent, useCardListPrice), normalizeGramQty(line.qty))
    );
  }
  const effective = effectiveUnitKurusForLine(line, customerLineDiscountPercent, useCardListPrice, categories);
  return kurusToTl(Math.round(effective * line.qty));
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
  return Math.round(effectiveUnitKurusForLine(line, customerLineDiscountPercent, useCardListPrice, categories) * line.qty);
}

export function lineToSaleInput(
  line: PosCartLine,
  categories: Category[],
  customerLineDiscountPercent = 0,
  useCardListPrice = false
): SaleLineInput {
  const unit = categorySaleUnitOf(categories, line.categoryId);
  const qty = unit === "gram" ? normalizeGramQty(line.qty) : Math.round(line.qty);
  const unitPriceKurus = effectiveUnitKurusForLine(line, customerLineDiscountPercent, useCardListPrice, categories);
  if (unit === "gram") {
    const cost = line.manualUnitCostKurus ?? line.costPriceKurus ?? 0;
    return {
      productId: line.id,
      qty,
      unitPriceKurus,
      unitCostKurus: Math.max(0, Math.round(Number(cost) || 0))
    };
  }
  return { productId: line.id, qty, unitPriceKurus };
}

export function newLineFromProduct(product: Product, qty: number, priceSource: CartPriceSource): PosCartLine {
  return {
    ...product,
    qty,
    priceSource,
    manualUnitPriceKurus: null,
    manualUnitCostKurus: null,
    lineExtraDiscountPercent: 0
  };
}
