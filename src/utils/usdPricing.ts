import { getCachedFxRates, getFxRates } from "../services/fxRates";
import { parseTrAmount } from "./currency";

/** Urun kartinda saklanan dolar tutarlari (cent) + kurdan TL kurus */

export function parseUsdAmount(raw: string): number | null {
  return parseTrAmount(String(raw ?? "").trim());
}

export function parseUsdTryRate(raw: string): number | null {
  const n = parseTrAmount(String(raw ?? "").trim());
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function usdToCents(usd: number): number {
  if (!Number.isFinite(usd) || usd < 0) return 0;
  return Math.round(usd * 100);
}

export function centsToUsd(cents: number): number {
  return Math.max(0, Math.round(Number(cents) || 0)) / 100;
}

/** USD → TL kurus; kur × dolar yuvarlanarak kurusa cevrilir */
export function usdCentsToTlKurus(usdCents: number, usdTry: number): number {
  const usd = centsToUsd(usdCents);
  if (!Number.isFinite(usdTry) || usdTry <= 0 || usd <= 0) return 0;
  return Math.round(usd * usdTry * 100);
}

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(centsToUsd(cents));
}

export function formatUsdTryRate(rate: number): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(rate);
}

/** Senkron: alt bardaki onbellek. Yoksa null. */
export function getCachedUsdTry(): number | null {
  const rate = getCachedFxRates()?.usdTry;
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return null;
  return rate;
}

/** Async: gerekirse kur yeniler. */
export async function resolveUsdTryRate(): Promise<number> {
  const cached = getCachedUsdTry();
  if (cached != null) return cached;
  const snap = await getFxRates();
  if (!Number.isFinite(snap.usdTry) || snap.usdTry <= 0) {
    throw new Error("Dolar kuru alinamadi. Alt bardaki kur yenilensin.");
  }
  return snap.usdTry;
}

export type UsdPricedFields = {
  pricedInUsd?: boolean;
  priceUsdCents?: number;
  costUsdCents?: number;
  /** Gelis anindaki kur; yoksa / 0 ise guncel kur */
  costUsdTryRate?: number;
  priceKurus?: number;
  costPriceKurus?: number;
};

export function isPricedInUsd(p: Pick<UsdPricedFields, "pricedInUsd">): boolean {
  return p.pricedInUsd === true;
}

/** Kayitli gelis kuru (hangi kurdan geldi); yoksa null */
export function productCostUsdTryRate(p: Pick<UsdPricedFields, "costUsdTryRate">): number | null {
  const r = Number(p.costUsdTryRate);
  if (!Number.isFinite(r) || r <= 0) return null;
  return r;
}

/** Satis fiyati: dolar urunde guncel kur, degilse kayitli TL */
export function effectiveProductPriceKurus(
  p: UsdPricedFields,
  usdTry: number | null | undefined = getCachedUsdTry()
): number {
  if (isPricedInUsd(p) && usdTry != null) {
    const cents = Math.max(0, Math.round(Number(p.priceUsdCents) || 0));
    if (cents > 0) return usdCentsToTlKurus(cents, usdTry);
  }
  return Math.max(0, Math.round(Number(p.priceKurus) || 0));
}

/**
 * Gelis / maliyet: dolar urunde once kayitli gelis kuru, yoksa verilen / guncel kur.
 * Kayitli costPriceKurus yedek.
 */
export function effectiveProductCostKurus(
  p: UsdPricedFields,
  usdTry: number | null | undefined = getCachedUsdTry()
): number {
  if (isPricedInUsd(p)) {
    const cents = Math.max(0, Math.round(Number(p.costUsdCents) || 0));
    const rate = productCostUsdTryRate(p) ?? (usdTry != null && usdTry > 0 ? usdTry : null);
    if (cents > 0 && rate != null) return usdCentsToTlKurus(cents, rate);
  }
  return Math.max(0, Math.round(Number(p.costPriceKurus) || 0));
}

/** Formda TL onizleme metni */
export function usdTlPreviewLabel(usdAmount: number, usdTry: number | null): string {
  if (usdTry == null || !Number.isFinite(usdAmount) || usdAmount < 0) return "Kur bekleniyor…";
  const kurus = Math.round(usdAmount * usdTry * 100);
  const tl = (kurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `≈ ${tl} ₺`;
}

/** Gelis onizleme: $ × kur = TL */
export function costUsdArrivalPreview(usdAmount: number, costRate: number | null): string {
  if (costRate == null || !Number.isFinite(usdAmount) || usdAmount < 0) return "Gelis kuru girin…";
  const kurus = Math.round(usdAmount * costRate * 100);
  const tl = (kurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${formatUsdTryRate(costRate)} kur × $${usdAmount.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} → ≈ ${tl} ₺`;
}

/** Dolar tik kapaninca TL alanlarina cevir (satis + gelis sifirlanmasin) */
export function convertUsdFormToTlFields(input: {
  priceUsd: string;
  costUsd: string;
  costUsdTryRate: string;
  fallbackPriceTl: string;
  fallbackCostTl: string;
  liveUsdTry?: number | null;
}): { priceTl: string; costTl: string } {
  const live = input.liveUsdTry !== undefined ? input.liveUsdTry : getCachedUsdTry();
  // Bos alani 0 sayma — yoksa gelis/satis TL fallback ezilip sifirlanir
  const priceRaw = String(input.priceUsd ?? "").trim();
  const costRaw = String(input.costUsd ?? "").trim();
  const priceUsd = priceRaw === "" ? null : parseUsdAmount(priceRaw);
  const costUsd = costRaw === "" ? null : parseUsdAmount(costRaw);
  const gelis = parseUsdTryRate(input.costUsdTryRate);
  let priceTl = input.fallbackPriceTl;
  let costTl = input.fallbackCostTl;
  if (priceUsd != null && priceUsd >= 0 && live != null && live > 0) {
    priceTl = (usdCentsToTlKurus(usdToCents(priceUsd), live) / 100).toFixed(2);
  }
  if (costUsd != null && costUsd >= 0) {
    const rate = gelis ?? (live != null && live > 0 ? live : null);
    if (rate != null) {
      costTl = (usdCentsToTlKurus(usdToCents(costUsd), rate) / 100).toFixed(2);
    }
  }
  return { priceTl, costTl };
}

/** TL'den dolar tike gecince USD alanlarini doldur */
export function convertTlFormToUsdFields(input: {
  priceTl: string;
  costTl: string;
  fallbackPriceUsd: string;
  fallbackCostUsd: string;
  liveUsdTry?: number | null;
}): { priceUsd: string; costUsd: string; costUsdTryRate: string } {
  const live = input.liveUsdTry !== undefined ? input.liveUsdTry : getCachedUsdTry();
  const rateStr = live != null ? live.toFixed(4) : "";
  if (live == null || live <= 0) {
    return {
      priceUsd: input.fallbackPriceUsd,
      costUsd: input.fallbackCostUsd,
      costUsdTryRate: rateStr
    };
  }
  // Bos TL gelis/satis 0 sayilmasin — fallback korunsun
  const priceRaw = String(input.priceTl ?? "").trim();
  const costRaw = String(input.costTl ?? "").trim();
  const pTl = priceRaw === "" ? null : parseTrAmount(priceRaw);
  const cTl = costRaw === "" ? null : parseTrAmount(costRaw);
  return {
    priceUsd: pTl != null && pTl >= 0 ? (pTl / live).toFixed(2) : input.fallbackPriceUsd,
    costUsd: cTl != null && cTl >= 0 ? (cTl / live).toFixed(2) : input.fallbackCostUsd,
    costUsdTryRate: rateStr
  };
}
