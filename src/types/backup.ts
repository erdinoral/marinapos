export const BACKUP_VERSION = 2;

export type BackupModuleId =
  | "catalog"
  | "customers"
  | "sales"
  | "stock"
  | "closures"
  | "cashflow"
  | "settings";

export const BACKUP_MODULE_IDS: BackupModuleId[] = [
  "catalog",
  "customers",
  "sales",
  "stock",
  "closures",
  "cashflow",
  "settings"
];

export const BACKUP_MODULE_LABELS: Record<
  BackupModuleId,
  { title: string; description: string }
> = {
  catalog: {
    title: "Urunler ve katalog",
    description: "Kategoriler, tedarikciler, urunler, tütün aromalari"
  },
  customers: {
    title: "Musteriler",
    description: "Musteri ve tedarikci kayitlari"
  },
  sales: {
    title: "Satislar ve satis gecmisi",
    description: "Fisler ve satis satirlari"
  },
  stock: {
    title: "Stok hareketleri",
    description: "Giris, cikis ve sayim kayitlari"
  },
  closures: {
    title: "Gunluk kapanislar",
    description: "Kapanis raporlari ve kasa ozetleri"
  },
  cashflow: {
    title: "Gelir / gider",
    description: "Bilanco ve nakit akisi kayitlari"
  },
  settings: {
    title: "Ayarlar ve firma bilgileri",
    description: "Acilis saati, firma unvani, esik degerler (lisans bilgisi korunur)"
  }
};

export type BackupModuleSelection = Record<BackupModuleId, boolean>;

export function allModulesSelected(sel: BackupModuleSelection): boolean {
  return BACKUP_MODULE_IDS.every((id) => sel[id]);
}

export function selectedModuleIds(sel: BackupModuleSelection): BackupModuleId[] {
  return BACKUP_MODULE_IDS.filter((id) => sel[id]);
}

export function emptyModuleSelection(all = false): BackupModuleSelection {
  return Object.fromEntries(BACKUP_MODULE_IDS.map((id) => [id, all])) as BackupModuleSelection;
}

export interface BackupInspectResult {
  legacy: boolean;
  createdAt: string | null;
  available: BackupModuleSelection;
  present: BackupModuleSelection;
}
