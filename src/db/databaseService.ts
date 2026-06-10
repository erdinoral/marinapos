import fs from "node:fs";
import path from "node:path";
import type { MonthEndReport } from "../types/models";
import { CashflowRepository } from "./repositories/cashflowRepository";
import { CustomerRepository } from "./repositories/customerRepository";
import { ProductRepository } from "./repositories/productRepository";
import { SalesRepository } from "./repositories/salesRepository";
import { SettingsRepository } from "./repositories/settingsRepository";
import { TobaccoAromaRepository } from "./repositories/tobaccoAromaRepository";
import type { BackupModuleStats } from "../types/backup";
import {
  applyRestoreModules,
  buildBackupPayload,
  BackupModuleId,
  inspectBackupParsed,
  parseBackupJsonText,
  type BackupInspectResult
} from "./backupModules";
import { JsonStore } from "./store";

export interface BackupFileInfo {
  name: string;
  fullPath: string;
  size: number;
  createdAt: string;
}

export class DatabaseService {
  private dataDir: string;
  readonly store: JsonStore;
  readonly products: ProductRepository;
  readonly customers: CustomerRepository;
  readonly sales: SalesRepository;
  readonly settings: SettingsRepository;
  readonly tobaccoAromas: TobaccoAromaRepository;
  readonly cashflow: CashflowRepository;

  constructor(dataDir: string, legacyDataDir?: string) {
    this.dataDir = dataDir;
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
    this.customers = new CustomerRepository(this.store);
    this.sales = new SalesRepository(this.store);
    this.settings = new SettingsRepository(this.store);
    this.tobaccoAromas = new TobaccoAromaRepository(this.store);
    this.cashflow = new CashflowRepository(this.store);
  }

  init() {
    this.store.save();
  }

  getBackupModuleStats(): BackupModuleStats {
    const state = this.store.getState();
    return {
      catalog: state.products.length,
      customers: state.customers.length,
      sales: state.sales.length,
      stock: state.stockMovements.length,
      closures: state.closures.length,
      cashflow: state.cashflowEntries.length,
      settings: state.settings ? 1 : 0
    };
  }

  createBackup(modules: BackupModuleId[], targetPath?: string): string {
    if (!modules.length) throw new Error("En az bir yedek bolumu secin.");
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(
      now.getHours()
    ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    let target = targetPath?.trim() ?? "";
    if (!target) {
      const backupDir = path.join(this.dataDir, "backups");
      fs.mkdirSync(backupDir, { recursive: true });
      target = path.join(backupDir, `marina-pos-backup-${stamp}.json`);
    }
    if (!target.toLowerCase().endsWith(".json")) {
      target = `${target}.json`;
    }
    const payload = buildBackupPayload(this.store.getState(), modules);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(payload, null, 2), "utf-8");
    /** Disariya (or. Belgeler) kaydedildiyse ayni dosyayi data/backups altina da kopyala — liste dolsun */
    try {
      const backupDir = path.join(this.dataDir, "backups");
      if (path.normalize(path.dirname(target)) !== path.normalize(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
        fs.copyFileSync(target, path.join(backupDir, path.basename(target)));
      }
    } catch {
      /* liste kopyasi basarisiz olsa bile dis hedef gecerli */
    }
    return target;
  }

  listBackups(): BackupFileInfo[] {
    const backupDir = path.join(this.dataDir, "backups");
    if (!fs.existsSync(backupDir)) return [];
    return fs
      .readdirSync(backupDir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => {
        const fullPath = path.join(backupDir, name);
        const stat = fs.statSync(fullPath);
        return {
          name,
          fullPath,
          size: stat.size,
          createdAt: stat.birthtime.toISOString()
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  inspectBackupByName(backupName: string): BackupInspectResult {
    const backupDir = path.join(this.dataDir, "backups");
    const safeName = path.basename(backupName);
    const source = path.join(backupDir, safeName);
    if (!fs.existsSync(source)) throw new Error("Yedek dosyasi bulunamadi.");
    return inspectBackupParsed(parseBackupJsonText(fs.readFileSync(source, "utf-8")));
  }

  inspectBackupFromJson(jsonText: string): BackupInspectResult {
    return inspectBackupParsed(parseBackupJsonText(jsonText));
  }

  restoreBackup(backupName: string, modules: BackupModuleId[]): void {
    if (!modules.length) throw new Error("En az bir bolum secin.");
    const backupDir = path.join(this.dataDir, "backups");
    const safeName = path.basename(backupName);
    const source = path.join(backupDir, safeName);
    if (!fs.existsSync(source)) throw new Error("Yedek dosyasi bulunamadi.");
    const parsed = parseBackupJsonText(fs.readFileSync(source, "utf-8"));
    this.restoreParsed(parsed, modules);
  }

  /**
   * Disaridan secilen yedek JSON (v2 modullu veya eski tam marina-pos.json).
   */
  restoreFromJsonText(jsonText: string, modules: BackupModuleId[]): void {
    if (!modules.length) throw new Error("En az bir bolum secin.");
    this.restoreParsed(parseBackupJsonText(jsonText), modules);
  }

  private restoreParsed(parsed: unknown, modules: BackupModuleId[]): void {
    const next = applyRestoreModules(this.store.getState(), parsed, modules);
    this.store.replaceState(next);
  }

  /** Secilen ay: satis/kapanis/sepet + gelir-gider (tek cagri) */
  getMonthEndReport(yearMonth: string): MonthEndReport {
    const ym = String(yearMonth ?? "").trim().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(ym)) {
      throw new Error("Ay formati YYYY-MM olmalidir.");
    }
    const snap = this.sales.getMonthEndSnapshot(ym);
    return {
      ...snap,
      cashflow: this.cashflow.getMonthlySummary(ym),
      cashflowEntries: this.cashflow.listForMonth(ym)
    };
  }
}
