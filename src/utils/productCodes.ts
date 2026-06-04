import type { Product } from "../types/models";

export function usageSets(products: Product[]) {
  const barcodes = new Set<string>();
  const codes = new Set<string>();
  for (const p of products) {
    const b = p.barcode?.trim().toLowerCase();
    const c = p.code?.trim().toLowerCase();
    if (b) barcodes.add(b);
    if (c) codes.add(c);
  }
  return { barcodes, codes };
}

/** 1001..1999, 2001..2999, ... ilk bos kod (1 dolunca 2 serisi vb.) */
export function allocateSequentialCode(codes: Set<string>): string {
  for (let series = 1; series <= 9; series++) {
    for (let n = 1; n <= 999; n++) {
      const candidate = `${series}${String(n).padStart(3, "0")}`;
      if (!codes.has(candidate.toLowerCase())) return candidate;
    }
  }
  return `X${Date.now().toString(36).toUpperCase()}`.slice(0, 8);
}

/** EAN-13: 12 haneli govde + kontrol hanesi */
export function ean13CheckDigit(body12: string): number {
  const digits = body12.replace(/\D/g, "").slice(0, 12).padStart(12, "0").split("").map(Number);
  const sum = digits.reduce((acc, d, idx) => acc + d * (idx % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

function randomBody12(): string {
  let s = "869";
  for (let i = 0; i < 9; i++) s += String(Math.floor(Math.random() * 10));
  return s;
}

/** Mevcut tum barkodlardan farkli EAN-13 */
export function generateUniqueBarcode13(products: Product[], extraBarcodes: string[] = []): string {
  const { barcodes } = usageSets(products);
  for (const x of extraBarcodes) {
    const t = x.trim().toLowerCase();
    if (t) barcodes.add(t);
  }
  for (let attempt = 0; attempt < 600; attempt++) {
    const body = randomBody12();
    const check = ean13CheckDigit(body);
    const full = `${body}${check}`;
    if (!barcodes.has(full.toLowerCase())) return full;
  }
  const t = Date.now();
  for (let k = 0; k < 1000; k++) {
    const mid = `${t}${k}`.replace(/\D/g, "").slice(-9).padStart(9, "0");
    const body = (`869${mid}`).slice(0, 12);
    const check = ean13CheckDigit(body);
    const full = `${body}${check}`;
    if (!barcodes.has(full.toLowerCase())) return full;
  }
  throw new Error("Benzersiz barkod uretilemedi; tekrar deneyin.");
}

/**
 * Barkodun govdesinden kisa kod: son 3 haneyi alir, onune 1..9 seri ekler (or. 1+789 -> 1789).
 * Cakisma olursa 2xxx..9xxx; hepsi doluysa allocateSequentialCode.
 */
export function uniqueCodeFromBarcode(barcode: string, products: Product[], extraCodes: string[] = []): string {
  const { codes } = usageSets(products);
  for (const x of extraCodes) {
    const t = x.trim().toLowerCase();
    if (t) codes.add(t);
  }

  const digits = barcode.replace(/\D/g, "");
  const body12 = digits.length >= 12 ? digits.slice(0, 12) : digits.padEnd(12, "0").slice(0, 12);
  const tail3 = body12.slice(-3);

  for (let series = 1; series <= 9; series++) {
    const candidate = `${series}${tail3}`;
    if (!codes.has(candidate.toLowerCase())) return candidate;
  }
  return allocateSequentialCode(codes);
}

export function validateProductCodeUnique(code: string, products: Product[]): boolean {
  const c = code.trim().toLowerCase();
  if (!c) return false;
  return !products.some((p) => p.code.trim().toLowerCase() === c);
}

export function validateProductBarcodeUnique(barcode: string, products: Product[]): boolean {
  const b = barcode.trim().toLowerCase();
  if (!b) return false;
  return !products.some((p) => p.barcode.trim().toLowerCase() === b);
}
