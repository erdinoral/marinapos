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
}
