const trInt = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

/** Kurus tutarini Turkce TL metnine cevirir: 4.567 ₺ veya 12,50 ₺ */
export function formatTlFromKurus(amountKurus: number): string {
  const k = Math.round(Number.isFinite(amountKurus) ? amountKurus : 0);
  const negative = k < 0;
  const abs = Math.abs(k);
  const lira = Math.floor(abs / 100);
  const kurusPart = abs % 100;
  const intStr = trInt.format(lira);
  const body = kurusPart === 0 ? intStr : `${intStr},${String(kurusPart).padStart(2, "0")}`;
  return `${negative ? "-" : ""}${body} ₺`;
}

export function tlToKurus(amountTl: number): number {
  return Math.round((Number.isFinite(amountTl) ? amountTl : 0) * 100);
}

export function kurusToTl(amountKurus: number): number {
  return (Number.isFinite(amountKurus) ? amountKurus : 0) / 100;
}

/**
 * TR form alani: "1.200,50" | "1.200" | "10.000" | "1200,5" | "12.50" -> TL sayisi.
 * Gecersiz/bos -> null.
 */
export function parseTrAmount(raw: string): number | null {
  let s = String(raw ?? "").trim().replace(/\s/g, "");
  if (s === "") return null;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Tam TL gosterimi (kurus yok): 1.200 */
export function formatTlWhole(amountTl: number): string {
  const n = Math.round(Number.isFinite(amountTl) ? amountTl : 0);
  const negative = n < 0;
  return `${negative ? "-" : ""}${trInt.format(Math.abs(n))}`;
}

/** Form alani: tam TL (kurus yok) */
export function parseTrAmountWhole(raw: string): number | null {
  const n = parseTrAmount(raw);
  if (n == null) return null;
  return Math.round(n);
}

/** @deprecated parseTrAmount kullanin */
export function parseTlDecimal(raw: string): number | null {
  return parseTrAmount(raw);
}

/** Zaten TL cinsinden bir sayiyi formatlar (kurus hassasiyeti korunur). */
export function formatTl(amountTl: number): string {
  return formatTlFromKurus(tlToKurus(amountTl));
}

/** Tablolarda: her zaman 2 ondalik, binlik nokta, ondalik virgul (orn. 90.023,73 ₺). */
export function formatTlTable(amountTl: number): string {
  const n = Number.isFinite(amountTl) ? amountTl : 0;
  const rounded = Math.round(n * 100) / 100;
  const negative = rounded < 0;
  const body = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Math.abs(rounded));
  return `${negative ? "-" : ""}${body} ₺`;
}

/** Kurus tutarini gosterim icin formatlar (formatTlFromKurus ile ayni). */
export function formatTry(amountKurus: number): string {
  return formatTlFromKurus(amountKurus);
}
