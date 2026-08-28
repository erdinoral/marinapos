/** Ucretsiz doviz kurlari — yerel onbellek (varsayilan 4 saat). */

const CACHE_KEY = "marina-fx-rates-v1";
/** API cagrisi en fazla 4 saatte bir (onbellek doluyken). */
export const FX_CACHE_TTL_MS = 4 * 60 * 60 * 1000;
/** Elle yenileme: en az 5 dk ara. */
const FORCE_MIN_INTERVAL_MS = 5 * 60 * 1000;

export type FxRatesSnapshot = {
  usdTry: number;
  eurTry: number | null;
  source: string;
  fetchedAt: string;
  rateUpdatedAt: string | null;
};

type CacheFile = {
  snapshot: FxRatesSnapshot;
  fetchedAtMs: number;
};

let memory: CacheFile | null = null;
let inFlight: Promise<FxRatesSnapshot> | null = null;

function readCache(): CacheFile | null {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheFile;
    if (!parsed?.snapshot?.usdTry || !parsed.fetchedAtMs) return null;
    memory = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(snapshot: FxRatesSnapshot): void {
  const row: CacheFile = { snapshot, fetchedAtMs: Date.now() };
  memory = row;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(row));
  } catch {
    /* */
  }
}

function isFresh(cache: CacheFile, ttlMs = FX_CACHE_TTL_MS): boolean {
  return Date.now() - cache.fetchedAtMs < ttlMs;
}

async function fetchFromDoviz(): Promise<FxRatesSnapshot> {
  const res = await fetch("https://doviz.dev/v1/try.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`doviz.dev HTTP ${res.status}`);
  const data = (await res.json()) as {
    USDTRY?: number;
    EURTRY?: number;
    _meta?: { source?: string; updated_at?: string };
  };
  const usdTry = Number(data.USDTRY);
  if (!Number.isFinite(usdTry) || usdTry <= 0) throw new Error("USDTRY yok");
  const eur = Number(data.EURTRY);
  return {
    usdTry,
    eurTry: Number.isFinite(eur) && eur > 0 ? eur : null,
    source: data._meta?.source?.trim() || "doviz.dev / TCMB",
    fetchedAt: new Date().toISOString(),
    rateUpdatedAt: data._meta?.updated_at ?? null
  };
}

async function fetchFromOpenErApi(): Promise<FxRatesSnapshot> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });
  if (!res.ok) throw new Error(`er-api HTTP ${res.status}`);
  const data = (await res.json()) as {
    result?: string;
    rates?: Record<string, number>;
    time_last_update_utc?: string;
    provider?: string;
  };
  if (data.result !== "success" || !data.rates?.TRY) throw new Error("er-api TRY yok");
  const usdTry = Number(data.rates.TRY);
  const eurUsd = Number(data.rates.EUR);
  const eurTry =
    Number.isFinite(eurUsd) && eurUsd > 0 ? Math.round((usdTry / eurUsd) * 10000) / 10000 : null;
  return {
    usdTry,
    eurTry,
    source: data.provider?.trim() || "open.er-api.com",
    fetchedAt: new Date().toISOString(),
    rateUpdatedAt: data.time_last_update_utc ?? null
  };
}

async function fetchRemote(): Promise<FxRatesSnapshot> {
  try {
    return await fetchFromDoviz();
  } catch {
    return await fetchFromOpenErApi();
  }
}

export function getCachedFxRates(): FxRatesSnapshot | null {
  return readCache()?.snapshot ?? null;
}

export function getFxCacheAgeMs(): number | null {
  const c = readCache();
  if (!c) return null;
  return Math.max(0, Date.now() - c.fetchedAtMs);
}

/**
 * Kur oku. force=true olsa bile FORCE_MIN_INTERVAL_MS icinde eski onbellegi dondurur
 * (API limitini korumak icin). ttl disinda veya onbellek yoksa agdan ceker.
 */
export async function getFxRates(options?: { force?: boolean }): Promise<FxRatesSnapshot> {
  const force = Boolean(options?.force);
  const cached = readCache();

  if (cached && !force && isFresh(cached)) {
    return cached.snapshot;
  }
  if (force && cached && Date.now() - cached.fetchedAtMs < FORCE_MIN_INTERVAL_MS) {
    return cached.snapshot;
  }
  if (cached && force === false && !isFresh(cached)) {
    /* stale — asagida yenile; basarisizsa stale dondur */
  }

  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const snap = await fetchRemote();
      writeCache(snap);
      return snap;
    } catch (e) {
      if (cached?.snapshot) return cached.snapshot;
      throw e instanceof Error ? e : new Error("Kur alinamadi");
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function formatFxTry(rate: number): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(rate);
}
