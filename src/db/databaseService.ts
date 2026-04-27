import fs from "node:fs";
import path from "node:path";
import { ProductRepository } from "./repositories/productRepository";
import { SalesRepository } from "./repositories/salesRepository";
import { SettingsRepository } from "./repositories/settingsRepository";
import { JsonStore } from "./store";

export class DatabaseService {
  readonly store: JsonStore;
  readonly products: ProductRepository;
  readonly sales: SalesRepository;
  readonly settings: SettingsRepository;

  constructor(dataDir: string, legacyDataDir?: string) {
    const targetFile = path.join(dataDir, "marina-pos.json");
    if (legacyDataDir) {
      const legacyFile = path.join(legacyDataDir, "marina-pos.json");
      if (!fs.existsSync(targetFile) && fs.existsSync(legacyFile)) {
        fs.mkdirSync(dataDir, { recursive: true });
        fs.copyFileSync(legacyFile, targetFile);
      }
    }
    this.store = new JsonStore(dataDir);
    this.products = new ProductRepository(this.store);
    this.sales = new SalesRepository(this.store);
    this.settings = new SettingsRepository(this.store);
  }

  init() {
    this.store.save();
  }
}
