/** Turkce soru metnini eslestirme icin sadelestirir */
export function normalizeQuery(raw: string): string {
  return raw
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function scoreKeywordHit(normalized: string, keywords: string[]): number {
  if (!normalized) return 0;
  let score = 0;
  for (const kw of keywords) {
    const k = normalizeQuery(kw);
    if (!k) continue;
    if (normalized.includes(k)) score += k.length + (k.includes(" ") ? 4 : 0);
  }
  return score;
}
