import { Settings } from "../../types/models";
import { JsonStore } from "../store";

export class SettingsRepository {
  constructor(private store: JsonStore) {}

  get(): Settings {
    return this.store.getState().settings;
  }

  setOpeningTime(openingTime: string) {
    this.store.getState().settings.openingTime = openingTime;
    this.store.save();
  }

  setClosureTime(closureTime: string) {
    this.store.getState().settings.closureTime = closureTime;
    this.store.save();
  }

  setOpeningCash(amountKurus: number) {
    const state = this.store.getState();
    state.settings.openingCashKurus = Math.max(0, Math.round(amountKurus));
    state.settings.openingCashDate = new Date().toISOString().slice(0, 10);
    this.store.save();
  }

  setCompanyInfo(patch: Partial<Settings>) {
    const s = this.store.getState().settings;
    if (patch.appTitle !== undefined) {
      const t = String(patch.appTitle ?? "").trim();
      s.appTitle = t || "Marina Nargile Otomasyon";
    }
    s.companyName = (patch.companyName ?? s.companyName ?? "").trim();
    s.companyAddress = (patch.companyAddress ?? s.companyAddress ?? "").trim();
    s.companyPhone = (patch.companyPhone ?? s.companyPhone ?? "").trim();
    s.companyEmail = (patch.companyEmail ?? s.companyEmail ?? "").trim();
    s.taxOffice = (patch.taxOffice ?? s.taxOffice ?? "").trim();
    s.taxNumber = (patch.taxNumber ?? s.taxNumber ?? "").trim();
    this.store.save();
  }

  setLicenseMeta(patch: { deviceId: string; lastOkAt: string | null; activationKey?: string | null }) {
    const s = this.store.getState().settings;
    s.licenseDeviceId = String(patch.deviceId ?? "").trim();
    s.licenseLastOkAt = patch.lastOkAt ? String(patch.lastOkAt) : "";
    if (patch.activationKey !== undefined) {
      s.licenseActivationKey = patch.activationKey ? String(patch.activationKey).trim() : "";
    }
    this.store.save();
  }
}
