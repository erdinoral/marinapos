import type { TobaccoAroma, TobaccoAromaInput, TobaccoAromaUpdate } from "../../types/models";
import { JsonStore } from "../store";

export class TobaccoAromaRepository {
  constructor(private store: JsonStore) {}

  list(): TobaccoAroma[] {
    return this.store
      .getState()
      .tobaccoAromas.slice()
      .sort((a, b) => a.name.localeCompare(b.name, "tr") || a.id - b.id);
  }

  create(input: TobaccoAromaInput): TobaccoAroma {
    const name = String(input.name ?? "").trim();
    if (!name) throw new Error("Aroma adi gerekli.");
    const content = String(input.content ?? "").trim();
    const state = this.store.getState();
    state.sequences.tobaccoAromaId = (state.sequences.tobaccoAromaId ?? 0) + 1;
    const row: TobaccoAroma = {
      id: state.sequences.tobaccoAromaId,
      name,
      content,
      imagePath: String(input.imagePath ?? "").trim(),
      createdAt: new Date().toISOString()
    };
    state.tobaccoAromas.push(row);
    this.store.save();
    return { ...row };
  }

  update(id: number, input: TobaccoAromaUpdate): TobaccoAroma {
    const state = this.store.getState();
    const row = state.tobaccoAromas.find((x) => x.id === id);
    if (!row) throw new Error("Aroma bulunamadi.");
    if (input.name != null) {
      const name = String(input.name).trim();
      if (!name) throw new Error("Aroma adi gerekli.");
      row.name = name;
    }
    if (input.content != null) row.content = String(input.content).trim();
    if (input.imagePath != null) row.imagePath = String(input.imagePath).trim();
    this.store.save();
    return { ...row };
  }

  delete(id: number): boolean {
    const state = this.store.getState();
    const idx = state.tobaccoAromas.findIndex((x) => x.id === id);
    if (idx < 0) return false;
    state.tobaccoAromas.splice(idx, 1);
    this.store.save();
    return true;
  }
}
