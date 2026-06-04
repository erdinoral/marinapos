import { activateLicenseKey, runLicenseCheck, type LicenseStatus } from "../src/services/licenseService";
import { normalizeLicenseKey } from "../src/services/licenseSupabase";
import type { SettingsRepository } from "../src/db/repositories/settingsRepository";
import {
  getLicenseRegistryUrl,
  getResolvedLicenseAppCode,
  getSupabaseLicenseConfig,
  isLicenseDevBypass,
  isLicenseDeviceBindRequired
} from "./licenseConfig";

export { getLicenseRegistryUrl, getSupabaseLicenseConfig, isLicenseDevBypass, isLicenseBackendConfigured } from "./licenseConfig";

function licenseFields(settingsRepo: SettingsRepository) {
  const s = settingsRepo.get();
  return {
    deviceId: s.licenseDeviceId ?? "",
    activationKey: s.licenseActivationKey ?? "",
    lastOkAt: s.licenseLastOkAt ?? null
  };
}

function withAppCode(status: LicenseStatus, supabase: ReturnType<typeof getSupabaseLicenseConfig>): LicenseStatus {
  return { ...status, appCode: getResolvedLicenseAppCode(supabase) };
}

export async function checkAndPersistLicense(settingsRepo: SettingsRepository): Promise<LicenseStatus> {
  const fields = licenseFields(settingsRepo);
  const supabase = getSupabaseLicenseConfig();
  const { status, newLastOkAt, newDeviceId, newActivationKey } = await runLicenseCheck({
    registryUrl: supabase ? "" : getLicenseRegistryUrl(),
    supabase,
    licenseAppCode: getResolvedLicenseAppCode(supabase),
    deviceId: fields.deviceId,
    activationKey: fields.activationKey,
    lastOkAt: fields.lastOkAt,
    isDevBypass: isLicenseDevBypass(),
    deviceBindRequired: isLicenseDeviceBindRequired()
  });
  settingsRepo.setLicenseMeta({
    deviceId: newDeviceId,
    lastOkAt: newLastOkAt,
    activationKey: newActivationKey ?? fields.activationKey
  });
  return withAppCode(status, supabase);
}

export async function activateAndPersistLicense(
  settingsRepo: SettingsRepository,
  licenseKeyRaw: string
): Promise<LicenseStatus> {
  const supabase = getSupabaseLicenseConfig();
  if (!supabase) {
    throw new Error("Lisans sunucusu (Supabase) yapilandirilmamis.");
  }
  const fields = licenseFields(settingsRepo);
  const licenseKey = normalizeLicenseKey(licenseKeyRaw);
  const { status, newLastOkAt, newDeviceId, newActivationKey } = await activateLicenseKey({
    supabase,
    licenseKey,
    deviceId: fields.deviceId,
    lastOkAt: fields.lastOkAt,
    licenseAppCode: getResolvedLicenseAppCode(supabase),
    deviceBindRequired: isLicenseDeviceBindRequired()
  });
  settingsRepo.setLicenseMeta({
    deviceId: newDeviceId,
    lastOkAt: newLastOkAt,
    activationKey: newActivationKey
  });
  return withAppCode(status, supabase);
}
