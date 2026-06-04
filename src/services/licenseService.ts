import { LICENSE_OFFLINE_GRACE_DAYS_DEFAULT } from "../config/license";
import type { LicenseState, LicenseStatus } from "../types/models";
import {
  bindLicenseKeyOnSupabase,
  fetchLicenseRegistryByKey,
  normalizeLicenseKey,
  resolveAppCode,
  type SupabaseLicenseConfig
} from "./licenseSupabase";

export type { LicenseState, LicenseStatus };

export interface LicenseDeviceEntry {
  locked?: boolean;
  message?: string;
  /** YYYY-MM-DD; gecince kilit */
  validUntil?: string;
}

export interface LicenseRegistry {
  version?: number;
  offlineGraceDays?: number;
  globalLock?: boolean;
  globalMessage?: string;
  devices?: Record<string, LicenseDeviceEntry>;
}

function randomDeviceSuffix() {
  const bytes = new Uint8Array(4);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export function ensureDeviceId(current: string | undefined): string {
  const t = String(current ?? "").trim();
  if (t.length >= 10 && (t.startsWith("POS-") || t.startsWith("MARINA-"))) return t;
  return `POS-${randomDeviceSuffix()}`;
}

export async function fetchLicenseRegistry(url: string): Promise<LicenseRegistry> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "Cache-Control": "no-cache" }
    });
    if (!res.ok) throw new Error(`Lisans listesi alinamadi (HTTP ${res.status})`);
    const data = (await res.json()) as LicenseRegistry;
    if (!data || typeof data !== "object") throw new Error("Lisans listesi gecersiz");
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function parseValidUntilDay(isoDay: string): number | null {
  const d = String(isoDay ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = new Date(`${d}T23:59:59`).getTime();
  return Number.isFinite(t) ? t : null;
}

function daysSince(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / (24 * 60 * 60 * 1000);
}

export function evaluateLicense(input: {
  registry: LicenseRegistry | null;
  deviceId: string;
  lastOkAt: string | null;
  fetchFailed: boolean;
  licenseBackendConfigured: boolean;
  isDevBypass: boolean;
}): LicenseStatus {
  const base = {
    deviceId: input.deviceId,
    lastCheckAt: input.lastOkAt,
    canRetry: true
  };

  if (input.isDevBypass) {
    return { ...base, state: "active", message: "", canRetry: false };
  }

  if (!input.licenseBackendConfigured) {
    return {
      ...base,
      state: "config_missing",
      message: "Lisans sunucusu yapilandirilmamis. Kurulumu yapan firma ile iletisime gecin."
    };
  }

  const grace = Math.max(1, Math.floor(input.registry?.offlineGraceDays ?? LICENSE_OFFLINE_GRACE_DAYS_DEFAULT));

  if (input.fetchFailed) {
    if (input.lastOkAt && daysSince(input.lastOkAt) <= grace) {
      return {
        ...base,
        state: "active",
        message: "Lisans sunucusuna ulasilamadi; son gecerli oturum kullaniliyor.",
        canRetry: true
      };
    }
    return {
      ...base,
      state: "offline_expired",
      message: `Internet baglantisi veya lisans sunucusu gerekli. Son kontrol ${grace} gunden eski.`
    };
  }

  const reg = input.registry!;
  if (reg.globalLock) {
    return {
      ...base,
      state: "locked",
      message: String(reg.globalMessage ?? "").trim() || "Lisans gecici olarak askiya alindi."
    };
  }

  const entry = reg.devices?.[input.deviceId];
  if (!entry) {
    return {
      ...base,
      state: "pending",
      message:
        "Bu cihaz henuz aktif edilmedi. Asagidaki cihaz kodunu lisans veren firmaniza gonderin; odeme sonrasi acilir."
    };
  }

  const until = parseValidUntilDay(entry.validUntil ?? "");
  if (until != null && Date.now() > until) {
    return {
      ...base,
      state: "locked",
      message: String(entry.message ?? "").trim() || "Lisans suresi doldu. Yenileme icin iletisime gecin."
    };
  }

  if (entry.locked) {
    return {
      ...base,
      state: "locked",
      message: String(entry.message ?? "").trim() || "Odeme gecikmesi nedeniyle erisim kapatildi."
    };
  }

  return { ...base, state: "active", message: "", canRetry: false };
}

async function fetchRegistry(opts: {
  registryUrl: string;
  supabase: SupabaseLicenseConfig | null;
  deviceId: string;
  activationKey: string;
  deviceBindRequired: boolean;
}): Promise<LicenseRegistry> {
  if (opts.supabase) {
    const key = normalizeLicenseKey(opts.activationKey);
    if (!key) throw new Error("Lisans anahtari gerekli.");
    return fetchLicenseRegistryByKey(opts.supabase, key, opts.deviceId, {
      deviceBindRequired: opts.deviceBindRequired
    });
  }
  return fetchLicenseRegistry(opts.registryUrl.trim());
}

export async function runLicenseCheck(opts: {
  registryUrl: string;
  supabase: SupabaseLicenseConfig | null;
  licenseAppCode?: string;
  deviceId: string;
  activationKey: string;
  lastOkAt: string | null;
  isDevBypass: boolean;
  /** false = gelistirme: anahtar kontrolu, device_id yazilmaz */
  deviceBindRequired?: boolean;
}): Promise<{
  status: LicenseStatus;
  newLastOkAt: string | null;
  newDeviceId: string;
  newActivationKey: string | null;
}> {
  const deviceId = ensureDeviceId(opts.deviceId);
  const activationKey = normalizeLicenseKey(opts.activationKey);
  const licenseAppCode = String(
    opts.licenseAppCode ?? (opts.supabase ? resolveAppCode(opts.supabase) : "marina-pos")
  ).trim();
  const licenseBackendConfigured = Boolean(opts.registryUrl.trim() || opts.supabase);
  const hasActivationKey = activationKey.length >= 6;
  const deviceBindRequired = opts.deviceBindRequired !== false;

  if (opts.isDevBypass) {
    return {
      status: evaluateLicense({
        registry: null,
        deviceId,
        lastOkAt: opts.lastOkAt,
        fetchFailed: false,
        licenseBackendConfigured: true,
        isDevBypass: true
      }),
      newLastOkAt: opts.lastOkAt,
      newDeviceId: deviceId,
      newActivationKey: activationKey || null
    };
  }

  if (opts.supabase && !hasActivationKey) {
    return {
      status: {
        deviceId,
        lastCheckAt: opts.lastOkAt,
        canRetry: false,
        hasActivationKey: false,
        state: "needs_activation",
        message: "Lisans anahtarinizi girin. Anahtar bir kez kaydedilir; ayni bilgisayarda tekrar sorulmaz."
      },
      newLastOkAt: opts.lastOkAt,
      newDeviceId: deviceId,
      newActivationKey: null
    };
  }

  let registry: LicenseRegistry | null = null;
  let fetchFailed = false;
  if (licenseBackendConfigured) {
    try {
      registry = await fetchRegistry({
        registryUrl: opts.registryUrl,
        supabase: opts.supabase,
        deviceId,
        activationKey,
        deviceBindRequired
      });
    } catch {
      fetchFailed = true;
    }
  }

  let status = evaluateLicense({
    registry,
    deviceId,
    lastOkAt: opts.lastOkAt,
    fetchFailed,
    licenseBackendConfigured,
    isDevBypass: false
  });

  if (status.state === "pending" && hasActivationKey && opts.supabase) {
    status = {
      ...status,
      state: "needs_activation",
      message:
        `Bu bilgisayarda kayitli lisans anahtari sunucuda bulunamadi veya app_code="${licenseAppCode}" icin gecerli degil. ` +
        "Supabase pos_licenses tablosunda ayni license_key + app_code satiri oldugundan emin olun; asagidan dogru anahtari tekrar girin."
    };
  }

  const now = new Date().toISOString();
  const newLastOkAt = status.state === "active" && !fetchFailed ? now : opts.lastOkAt;

  return {
    status: {
      ...status,
      lastCheckAt: newLastOkAt,
      hasActivationKey,
      appCode: licenseAppCode
    },
    newLastOkAt,
    newDeviceId: deviceId,
    newActivationKey: hasActivationKey ? activationKey : null
  };
}

export async function activateLicenseKey(opts: {
  supabase: SupabaseLicenseConfig;
  licenseKey: string;
  deviceId: string;
  lastOkAt: string | null;
  licenseAppCode?: string;
  deviceBindRequired?: boolean;
}): Promise<{
  status: LicenseStatus;
  newLastOkAt: string | null;
  newDeviceId: string;
  newActivationKey: string;
}> {
  const deviceId = ensureDeviceId(opts.deviceId);
  const activationKey = normalizeLicenseKey(opts.licenseKey);
  if (activationKey.length < 6) {
    throw new Error("Lisans anahtari cok kisa.");
  }

  await bindLicenseKeyOnSupabase(opts.supabase, activationKey, deviceId, {
    deviceBindRequired: opts.deviceBindRequired !== false
  });

  const result = await runLicenseCheck({
    registryUrl: "",
    supabase: opts.supabase,
    licenseAppCode: opts.licenseAppCode,
    deviceId,
    activationKey,
    lastOkAt: opts.lastOkAt,
    isDevBypass: false,
    deviceBindRequired: opts.deviceBindRequired !== false
  });
  return { ...result, newActivationKey: activationKey };
}
