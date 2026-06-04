import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { LICENSE_APP_CODE } from "../src/config/licenseApp";
import { readSupabaseCredentialsFromEnv } from "../src/config/supabaseEnv";
import { isSupabaseLicenseConfig, resolveAppCode, type SupabaseLicenseConfig } from "../src/services/licenseSupabase";
import { loadEnvLocal } from "./loadEnvLocal";

let envLocalLoaded = false;
function ensureEnvLocal() {
  if (envLocalLoaded) return;
  envLocalLoaded = true;
  if (!app.isPackaged) {
    loadEnvLocal([process.cwd(), app.getAppPath()]);
  }
}

function licenseAppCodeFromEnv(fallback?: string): string {
  const fromEnv = String(process.env.MARINA_LICENSE_APP_CODE ?? "").trim();
  return fromEnv || String(fallback ?? "").trim() || LICENSE_APP_CODE;
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readTextFile(filePath: string): string {
  try {
    if (!fs.existsSync(filePath)) return "";
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return "";
  }
}

function configCandidates(name: string): string[] {
  return [path.join(app.getAppPath(), "build", name), path.join(process.cwd(), "build", name)];
}

export function getLicenseRegistryUrl(): string {
  const fromEnv = String(process.env.MARINA_LICENSE_URL ?? "").trim();
  if (fromEnv) return fromEnv;
  for (const p of configCandidates("license-registry.url")) {
    const raw = readTextFile(p);
    if (raw) return raw;
  }
  return "";
}

function normalizeSupabaseCfg(raw: SupabaseLicenseConfig): SupabaseLicenseConfig {
  return {
    ...raw,
    appCode: resolveAppCode(raw)
  };
}

export function getSupabaseLicenseConfig(): SupabaseLicenseConfig | null {
  ensureEnvLocal();
  const { url, anonKey } = readSupabaseCredentialsFromEnv();
  if (url && anonKey) {
    return normalizeSupabaseCfg({ url, anonKey, appCode: licenseAppCodeFromEnv() });
  }
  for (const p of configCandidates("supabase-license.json")) {
    const parsed = readJsonFile<unknown>(p);
    if (isSupabaseLicenseConfig(parsed)) {
      return normalizeSupabaseCfg({ ...parsed, appCode: licenseAppCodeFromEnv(parsed.appCode) });
    }
  }
  return null;
}

export function isLicenseBackendConfigured(): boolean {
  return Boolean(getLicenseRegistryUrl() || getSupabaseLicenseConfig());
}

export function isLicenseDevBypass(): boolean {
  if (app.isPackaged) return false;
  if (process.env.MARINA_SKIP_LICENSE === "1") return true;
  return !isLicenseBackendConfigured();
}

/**
 * Musteri .exe: cihaz kodu Supabase'e yazilir (tek PC).
 * Gelistirme: varsayilan kapali — musteri anahtarini deneince device_id calinmaz.
 * Zorla: MARINA_LICENSE_BIND_DEVICE=1
 */
export function isLicenseDeviceBindRequired(): boolean {
  const force = String(process.env.MARINA_LICENSE_BIND_DEVICE ?? "").trim();
  if (force === "1") return true;
  if (force === "0") return false;
  return app.isPackaged;
}

/** Musteri kurulumu: marina-pos. Gelistirme: .env.local MARINA_LICENSE_APP_CODE */
export function getResolvedLicenseAppCode(cfg?: ReturnType<typeof getSupabaseLicenseConfig>): string {
  ensureEnvLocal();
  if (cfg) return resolveAppCode(cfg);
  const fromEnv = String(process.env.MARINA_LICENSE_APP_CODE ?? "").trim();
  if (fromEnv) return resolveAppCode({ url: "", anonKey: "", appCode: fromEnv });
  return LICENSE_APP_CODE;
}
