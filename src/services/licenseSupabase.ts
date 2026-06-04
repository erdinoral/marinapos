import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { LICENSE_APP_CODE } from "../config/licenseApp";
import type { LicenseRegistry } from "./licenseService";

export interface SupabaseLicenseConfig {
  url: string;
  anonKey: string;
  /** Bu uygulama; varsayilan LICENSE_APP_CODE */
  appCode?: string;
  configTable?: string;
  /** Varsayilan: pos_licenses */
  licensesTable?: string;
}

export function isSupabaseLicenseConfig(v: unknown): v is SupabaseLicenseConfig {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return Boolean(String(o.url ?? "").trim() && String(o.anonKey ?? "").trim());
}

export function resolveAppCode(cfg: SupabaseLicenseConfig): string {
  const raw = String(cfg.appCode ?? LICENSE_APP_CODE).trim() || LICENSE_APP_CODE;
  return raw.toLowerCase();
}

export function normalizeLicenseKey(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function supabaseClient(cfg: SupabaseLicenseConfig): SupabaseClient {
  return createClient(cfg.url.trim(), cfg.anonKey.trim(), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function licensesTable(cfg: SupabaseLicenseConfig): string {
  return String(cfg.licensesTable ?? "pos_licenses").trim() || "pos_licenses";
}

type LicenseRow = {
  license_key?: string;
  app_code?: string;
  device_id?: string | null;
  locked?: boolean;
  message?: string | null;
  valid_until?: string | null;
};

/** Anahtar eslesmesi (buyuk/kucuk harf duyarsiz); app_code tam eslesme */
async function findLicenseRow(
  client: SupabaseClient,
  table: string,
  licenseKey: string,
  appCode: string
): Promise<{ row: LicenseRow | null; wrongApp: LicenseRow | null }> {
  const key = normalizeLicenseKey(licenseKey);
  const app = String(appCode).trim().toLowerCase() || LICENSE_APP_CODE;

  const byApp = await client
    .from(table)
    .select("license_key, app_code, device_id, locked, message, valid_until")
    .ilike("license_key", key)
    .ilike("app_code", app)
    .maybeSingle();

  if (byApp.error) throw new Error(byApp.error.message);
  if (byApp.data?.license_key) {
    return { row: byApp.data as LicenseRow, wrongApp: null };
  }

  const anyApp = await client
    .from(table)
    .select("license_key, app_code, device_id, locked, message, valid_until")
    .ilike("license_key", key)
    .maybeSingle();

  if (anyApp.error) throw new Error(anyApp.error.message);
  const other = anyApp.data as LicenseRow | null;
  if (other?.license_key) {
    const otherApp = String(other.app_code ?? "").trim().toLowerCase();
    if (otherApp && otherApp !== app) {
      return { row: null, wrongApp: other };
    }
  }

  return { row: null, wrongApp: null };
}

function licenseLookupError(key: string, appCode: string, wrongApp: LicenseRow | null): Error {
  if (wrongApp?.license_key) {
    const got = String(wrongApp.app_code ?? "").trim() || "?";
    return new Error(
      `Lisans anahtari "${got}" icin kayitli; bu oturum "${appCode}" ariyor. ` +
        `Gelistirmede proje kokune .env.local ekleyin:\nMARINA_LICENSE_APP_CODE=${got}\n` +
        `Sonra npm run dev / Electron'u yeniden baslatin. (Musteri kurulumu marina-pos kalir.)`
    );
  }
  return new Error(
    `Lisans anahtari bulunamadi ("${key}"). Supabase tablosu pos_licenses: ` +
      `license_key tam bu metin (buyuk harf onerilir), app_code="${appCode}", locked=false. ` +
      `Farkli Supabase projesine mi baktiginizi kontrol edin.`
  );
}

async function fetchGlobalConfig(client: SupabaseClient, configTable: string) {
  const configRes = await client
    .from(configTable)
    .select("global_lock, global_message, offline_grace_days")
    .eq("id", 1)
    .maybeSingle();
  if (configRes.error) throw new Error(configRes.error.message);
  const c = configRes.data as {
    global_lock?: boolean;
    global_message?: string | null;
    offline_grace_days?: number | null;
  } | null;
  return {
    offlineGraceDays: Math.max(1, Math.floor(Number(c?.offline_grace_days) || 7)),
    globalLock: Boolean(c?.global_lock),
    globalMessage: String(c?.global_message ?? "").trim() || undefined
  };
}

function entryFromRow(row: { locked?: boolean; message?: string | null; valid_until?: string | null }) {
  const validUntil = row.valid_until ? String(row.valid_until).slice(0, 10) : undefined;
  return {
    locked: Boolean(row.locked),
    message: String(row.message ?? "").trim() || undefined,
    validUntil: validUntil && validUntil.length >= 10 ? validUntil : undefined
  };
}

/** Girilen anahtar + app_code ile Supabase kontrolu */
export async function fetchLicenseRegistryByKey(
  cfg: SupabaseLicenseConfig,
  licenseKey: string,
  deviceId: string,
  options?: { deviceBindRequired?: boolean }
): Promise<LicenseRegistry> {
  const deviceBindRequired = options?.deviceBindRequired !== false;
  const key = normalizeLicenseKey(licenseKey);
  const appCode = resolveAppCode(cfg);
  const configTable = String(cfg.configTable ?? "pos_license_config").trim() || "pos_license_config";
  const table = licensesTable(cfg);
  const client = supabaseClient(cfg);

  const global = await fetchGlobalConfig(client, configTable);
  const { row } = await findLicenseRow(client, table, key, appCode);

  const devices: LicenseRegistry["devices"] = {};
  if (row?.license_key) {
    const bound = String(row.device_id ?? "").trim();
    if (deviceBindRequired && bound && bound !== deviceId) {
      devices[deviceId] = {
        locked: true,
        message: "Bu lisans anahtari baska bir cihazda kayitli."
      };
    } else {
      devices[deviceId] = entryFromRow(row);
    }
  }

  return { version: 1, ...global, devices };
}

/** Ilk kurulum: anahtari bu cihaza bagla */
export async function bindLicenseKeyOnSupabase(
  cfg: SupabaseLicenseConfig,
  licenseKey: string,
  deviceId: string,
  options?: { deviceBindRequired?: boolean }
): Promise<void> {
  const deviceBindRequired = options?.deviceBindRequired !== false;
  const key = normalizeLicenseKey(licenseKey);
  const appCode = resolveAppCode(cfg);
  const table = licensesTable(cfg);
  const client = supabaseClient(cfg);

  const { row, wrongApp } = await findLicenseRow(client, table, key, appCode);
  if (!row?.license_key) {
    throw licenseLookupError(key, appCode, wrongApp);
  }
  if (row.locked) throw new Error(String(row.message ?? "").trim() || "Bu lisans anahtari kilitli.");

  if (!deviceBindRequired) return;

  const bound = String(row.device_id ?? "").trim();
  if (bound && bound !== deviceId) {
    throw new Error("Bu anahtar baska bir bilgisayarda kullaniliyor.");
  }
  if (bound === deviceId) return;

  const dbKey = String(row.license_key ?? key);
  const updated = await client
    .from(table)
    .update({ device_id: deviceId, updated_at: new Date().toISOString() })
    .eq("license_key", dbKey)
    .ilike("app_code", appCode)
    .is("device_id", null)
    .select("license_key")
    .maybeSingle();

  if (updated.error) throw new Error(updated.error.message);
  if (!updated.data) {
    throw new Error("Anahtar baglanamadi. Baska cihazda acilmis olabilir.");
  }
}
