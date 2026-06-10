import type { MarinaStore } from "./store";
import type { Settings } from "../types/models";
import {
  BACKUP_MODULE_IDS,
  BACKUP_VERSION,
  type BackupInspectResult,
  type BackupModuleId,
  type BackupModuleSelection,
  emptyModuleSelection
} from "../types/backup";

export type { BackupModuleId, BackupModuleSelection, BackupInspectResult } from "../types/backup";
export {
  BACKUP_MODULE_IDS,
  BACKUP_MODULE_LABELS,
  BACKUP_VERSION,
  allModulesSelected,
  emptyModuleSelection,
  selectedModuleIds
} from "../types/backup";

interface MarinaBackupFileV2 {
  backupVersion: typeof BACKUP_VERSION;
  app: "marina-pos";
  createdAt: string;
  modules: BackupModuleSelection;
  data: Partial<MarinaStore>;
}

function pickCatalog(state: MarinaStore): Partial<MarinaStore> {
  return {
    categories: state.categories,
    suppliers: state.suppliers,
    products: state.products,
    stockCostLayers: state.stockCostLayers,
    tobaccoAromas: state.tobaccoAromas,
    sequences: {
      productId: state.sequences.productId,
      categoryId: state.sequences.categoryId,
      supplierId: state.sequences.supplierId,
      stockCostLayerId: state.sequences.stockCostLayerId,
      tobaccoAromaId: state.sequences.tobaccoAromaId,
      saleId: 0,
      saleItemId: 0,
      stockMovementId: 0,
      closureId: 0,
      customerId: 0,
      cashflowEntryId: 0,
      stockReceiveBatchId: 0
    }
  };
}

function pickCustomers(state: MarinaStore): Partial<MarinaStore> {
  return {
    customers: state.customers,
    customerProductPrices: state.customerProductPrices,
    sequences: {
      customerId: state.sequences.customerId,
      productId: 0,
      saleId: 0,
      saleItemId: 0,
      stockMovementId: 0,
      closureId: 0,
      categoryId: 0,
      supplierId: 0,
      tobaccoAromaId: 0,
      cashflowEntryId: 0,
      stockCostLayerId: 0,
      stockReceiveBatchId: 0
    }
  };
}

function pickSales(state: MarinaStore): Partial<MarinaStore> {
  return {
    sales: state.sales,
    saleItems: state.saleItems,
    sequences: {
      saleId: state.sequences.saleId,
      saleItemId: state.sequences.saleItemId,
      productId: 0,
      stockMovementId: 0,
      closureId: 0,
      categoryId: 0,
      customerId: 0,
      supplierId: 0,
      tobaccoAromaId: 0,
      cashflowEntryId: 0,
      stockCostLayerId: 0,
      stockReceiveBatchId: 0
    }
  };
}

function pickStock(state: MarinaStore): Partial<MarinaStore> {
  return {
    stockMovements: state.stockMovements,
    stockCostLayers: state.stockCostLayers,
    sequences: {
      stockMovementId: state.sequences.stockMovementId,
      stockCostLayerId: state.sequences.stockCostLayerId,
      productId: 0,
      saleId: 0,
      saleItemId: 0,
      closureId: 0,
      categoryId: 0,
      customerId: 0,
      supplierId: 0,
      tobaccoAromaId: 0,
      cashflowEntryId: 0,
      stockReceiveBatchId: state.sequences.stockReceiveBatchId
    }
  };
}

function pickClosures(state: MarinaStore): Partial<MarinaStore> {
  return {
    closures: state.closures,
    sequences: {
      closureId: state.sequences.closureId,
      productId: 0,
      saleId: 0,
      saleItemId: 0,
      stockMovementId: 0,
      categoryId: 0,
      customerId: 0,
      supplierId: 0,
      tobaccoAromaId: 0,
      cashflowEntryId: 0,
      stockCostLayerId: 0,
      stockReceiveBatchId: 0
    }
  };
}

function pickCashflow(state: MarinaStore): Partial<MarinaStore> {
  return {
    cashflowEntries: state.cashflowEntries,
    sequences: {
      cashflowEntryId: state.sequences.cashflowEntryId,
      productId: 0,
      saleId: 0,
      saleItemId: 0,
      stockMovementId: 0,
      closureId: 0,
      categoryId: 0,
      customerId: 0,
      supplierId: 0,
      tobaccoAromaId: 0,
      stockCostLayerId: 0,
      stockReceiveBatchId: 0
    }
  };
}

function pickSettings(state: MarinaStore): Partial<MarinaStore> {
  return { settings: state.settings };
}

const PICKERS: Record<BackupModuleId, (s: MarinaStore) => Partial<MarinaStore>> = {
  catalog: pickCatalog,
  customers: pickCustomers,
  sales: pickSales,
  stock: pickStock,
  closures: pickClosures,
  cashflow: pickCashflow,
  settings: pickSettings
};

function mergePartialData(target: Partial<MarinaStore>, part: Partial<MarinaStore>) {
  if (part.categories) target.categories = part.categories;
  if (part.suppliers) target.suppliers = part.suppliers;
  if (part.products) target.products = part.products;
  if (part.tobaccoAromas) target.tobaccoAromas = part.tobaccoAromas;
  if (part.customers) target.customers = part.customers;
  if (part.customerProductPrices) target.customerProductPrices = part.customerProductPrices;
  if (part.sales) target.sales = part.sales;
  if (part.saleItems) target.saleItems = part.saleItems;
  if (part.stockMovements) target.stockMovements = part.stockMovements;
  if (part.stockCostLayers) target.stockCostLayers = part.stockCostLayers;
  if (part.closures) target.closures = part.closures;
  if (part.cashflowEntries) target.cashflowEntries = part.cashflowEntries;
  if (part.settings) target.settings = part.settings;
  if (part.sequences) {
    target.sequences = { ...(target.sequences ?? {}), ...part.sequences } as MarinaStore["sequences"];
  }
}

export function buildBackupPayload(state: MarinaStore, modules: BackupModuleId[]): MarinaBackupFileV2 {
  const selection = emptyModuleSelection(false);
  for (const id of modules) selection[id] = true;
  const data: Partial<MarinaStore> = {};
  for (const id of modules) {
    mergePartialData(data, PICKERS[id](state));
  }
  return {
    backupVersion: BACKUP_VERSION,
    app: "marina-pos",
    createdAt: new Date().toISOString(),
    modules: selection,
    data
  };
}

function modulePresentInData(data: Partial<MarinaStore>, id: BackupModuleId): boolean {
  switch (id) {
    case "catalog":
      return (
        (data.categories?.length ?? 0) > 0 ||
        (data.products?.length ?? 0) > 0 ||
        (data.suppliers?.length ?? 0) > 0 ||
        (data.tobaccoAromas?.length ?? 0) > 0
      );
    case "customers":
      return (data.customers?.length ?? 0) > 0;
    case "sales":
      return data.sales !== undefined || data.saleItems !== undefined;
    case "stock":
      return (data.stockMovements?.length ?? 0) > 0;
    case "closures":
      return (data.closures?.length ?? 0) > 0;
    case "cashflow":
      return (data.cashflowEntries?.length ?? 0) > 0;
    case "settings":
      return data.settings != null;
    default:
      return false;
  }
}

export function inspectBackupParsed(parsed: unknown): BackupInspectResult {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Yedek icerigi bos veya gecersiz.");
  }
  const o = parsed as Record<string, unknown>;
  const legacy = o.backupVersion !== BACKUP_VERSION;
  if (legacy) {
    if (!Array.isArray(o.products)) {
      throw new Error("Bu dosya Marina yedegi gibi gorunmuyor (products yok).");
    }
    const available = emptyModuleSelection(true);
    return {
      legacy: true,
      createdAt: null,
      available,
      present: available
    };
  }
  const file = parsed as MarinaBackupFileV2;
  const available = { ...emptyModuleSelection(false), ...file.modules };
  const present = emptyModuleSelection(false);
  for (const id of BACKUP_MODULE_IDS) {
    present[id] = available[id] && modulePresentInData(file.data ?? {}, id);
  }
  return {
    legacy: false,
    createdAt: typeof file.createdAt === "string" ? file.createdAt : null,
    available,
    present
  };
}

function mergeSettingsPreserveLicense(current: Settings, fromBackup: Settings): Settings {
  return {
    ...fromBackup,
    licenseDeviceId: current.licenseDeviceId ?? fromBackup.licenseDeviceId ?? "",
    licenseLastOkAt: current.licenseLastOkAt ?? fromBackup.licenseLastOkAt ?? "",
    licenseActivationKey: current.licenseActivationKey ?? fromBackup.licenseActivationKey ?? ""
  };
}

function bumpSequence(current: number, backup: number | undefined): number {
  return Math.max(current, backup ?? 0);
}

export function applyRestoreModules(
  current: MarinaStore,
  backupRoot: unknown,
  modulesToRestore: BackupModuleId[]
): MarinaStore {
  const inspect = inspectBackupParsed(backupRoot);
  const backupData: Partial<MarinaStore> = inspect.legacy
    ? (backupRoot as MarinaStore)
    : (backupRoot as MarinaBackupFileV2).data ?? {};

  const next: MarinaStore = JSON.parse(JSON.stringify(current)) as MarinaStore;

  for (const id of modulesToRestore) {
    if (!inspect.legacy && !inspect.available[id]) continue;
    const part = inspect.legacy ? backupData : extractModuleSlice(backupData, id);
    switch (id) {
      case "catalog":
        if (part.categories) next.categories = part.categories;
        if (part.suppliers) next.suppliers = part.suppliers;
        if (part.products) next.products = part.products;
        if (part.tobaccoAromas) next.tobaccoAromas = part.tobaccoAromas;
        break;
      case "customers":
        if (part.customers) next.customers = part.customers;
        if (part.customerProductPrices) next.customerProductPrices = part.customerProductPrices;
        break;
      case "sales":
        if (part.sales) next.sales = part.sales;
        if (part.saleItems) next.saleItems = part.saleItems;
        break;
      case "stock":
        if (part.stockMovements) next.stockMovements = part.stockMovements;
        if (part.stockCostLayers) next.stockCostLayers = part.stockCostLayers;
        break;
      case "closures":
        if (part.closures) next.closures = part.closures;
        break;
      case "cashflow":
        if (part.cashflowEntries) next.cashflowEntries = part.cashflowEntries;
        break;
      case "settings":
        if (part.settings) next.settings = mergeSettingsPreserveLicense(current.settings, part.settings);
        break;
      default:
        break;
    }
    const seq = part.sequences;
    if (seq) {
      next.sequences.productId = bumpSequence(next.sequences.productId, seq.productId);
      next.sequences.categoryId = bumpSequence(next.sequences.categoryId, seq.categoryId);
      next.sequences.supplierId = bumpSequence(next.sequences.supplierId, seq.supplierId);
      next.sequences.tobaccoAromaId = bumpSequence(next.sequences.tobaccoAromaId, seq.tobaccoAromaId);
      next.sequences.customerId = bumpSequence(next.sequences.customerId, seq.customerId);
      next.sequences.saleId = bumpSequence(next.sequences.saleId, seq.saleId);
      next.sequences.saleItemId = bumpSequence(next.sequences.saleItemId, seq.saleItemId);
      next.sequences.stockMovementId = bumpSequence(next.sequences.stockMovementId, seq.stockMovementId);
      next.sequences.closureId = bumpSequence(next.sequences.closureId, seq.closureId);
      next.sequences.cashflowEntryId = bumpSequence(next.sequences.cashflowEntryId, seq.cashflowEntryId);
    }
  }

  return next;
}

function extractModuleSlice(data: Partial<MarinaStore>, id: BackupModuleId): Partial<MarinaStore> {
  switch (id) {
    case "catalog":
      return {
        categories: data.categories,
        suppliers: data.suppliers,
        products: data.products,
        tobaccoAromas: data.tobaccoAromas,
        sequences: data.sequences
      };
    case "customers":
      return { customers: data.customers, customerProductPrices: data.customerProductPrices, sequences: data.sequences };
    case "sales":
      return { sales: data.sales, saleItems: data.saleItems, sequences: data.sequences };
    case "stock":
      return { stockMovements: data.stockMovements, stockCostLayers: data.stockCostLayers, sequences: data.sequences };
    case "closures":
      return { closures: data.closures, sequences: data.sequences };
    case "cashflow":
      return { cashflowEntries: data.cashflowEntries, sequences: data.sequences };
    case "settings":
      return { settings: data.settings };
    default:
      return {};
  }
}

export function parseBackupJsonText(jsonText: string): unknown {
  try {
    return JSON.parse(jsonText);
  } catch {
    throw new Error("Dosya gecerli JSON degil.");
  }
}
