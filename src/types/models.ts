import type { BackupInspectResult, BackupModuleId, BackupModuleStats } from "./backup";

export type FeedbackImagePayload = {
  fileName: string;
  mimeType: string;
  base64: string;
};

export type AppUpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export type AppUpdateInfo = {
  enabled: boolean;
  currentVersion: string;
  phase: AppUpdatePhase;
  latestVersion?: string;
  releaseNotes?: string;
  releasePageUrl: string;
  percent?: number;
  transferred?: number;
  total?: number;
  bytesPerSecond?: number;
  error?: string;
  devMode?: boolean;
};

export type FeedbackSubmitInput = {
  title: string;
  body: string;
  contactName: string;
  companyName?: string;
  accountEmail?: string;
  appVersion?: string;
  image?: FeedbackImagePayload | null;
};

export type FeedbackStatus = "new" | "read" | "in_progress" | "answered" | "closed";

export type FeedbackReplyItem = {
  id: string;
  createdAt: string;
  title: string;
  body: string;
  contactName: string;
  status: FeedbackStatus;
  adminReply: string;
  repliedAt: string | null;
};

export type PaymentType = "cash" | "card" | "mixed";
export type SaleKind = "sale" | "return" | "debt_payment";

/** Karma odeme: nakit + kart tutarlari (kurus) */
export interface PaymentSplitAmounts {
  cashAmountKurus: number;
  cardAmountKurus: number;
}

export type LicenseState =
  | "active"
  | "locked"
  | "pending"
  | "needs_activation"
  | "offline_expired"
  | "config_missing";

export interface LicenseStatus {
  state: LicenseState;
  deviceId: string;
  message: string;
  lastCheckAt: string | null;
  canRetry: boolean;
  /** Yerelde kayitli anahtar (maskeli gosterim icin son 4 karakter) */
  hasActivationKey?: boolean;
  /** Supabase pos_licenses.app_code — dev'de .env ile degistirilebilir */
  appCode?: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  barcode: string;
  code: string;
  /** Adet: kurus/adet. Gram: 1000 g paketinin toplam kurusu (UI: TL / 1000 g). */
  priceKurus: number;
  /** Adet: kurus/adet. Gram: 1000 g paket maliyeti kurus (UI: TL / 1000 g). */
  costPriceKurus: number;
  discountPercent: number;
  stockQty: number;
  imagePath: string;
  categoryId: number;
  supplierId: number;
  /** Birincil disindaki tedarikciler (stok girisi / toplu fatura listesi) */
  alternateSupplierIds?: number[];
  isActive: number;
  /** Toptancı / malzeme bilgisi */
  material: string;
  /** KDV oranı (örn. 20) */
  vatRatePercent: number;
  /** Satış fiyatı KDV dahil gösterim */
  priceIncludesVat: boolean;
  /** Yerli üretim */
  domesticMade: boolean;
  /**
   * true ise satis/gelis dolar cinsinden tutulur; TL kurus guncel USD/TRY kurundan hesaplanir.
   * Ithal urunler icin.
   */
  pricedInUsd: boolean;
  /** Satis fiyati ABD dolari cent (orn. 600 = 6.00 USD). pricedInUsd degilse 0. */
  priceUsdCents: number;
  /** Gelis / maliyet ABD dolari cent. pricedInUsd degilse 0. */
  costUsdCents: number;
  /**
   * Gelis anindaki USD/TRY kuru (hangi kurdan geldi).
   * Maliyet TL = costUsd × bu kur (yuvarlamali). Satis guncel kurdan hesaplanir.
   */
  costUsdTryRate: number;
  /** Son perakende fiyat güncellemesi (ISO) */
  lastPriceChangeAt: string;
  /** 0 ise perakende fiyat kullanılır */
  wholesalePriceKurus: number;
  /** 0 ise yok. POS odeme Kart iken birim fiyat (kurus); nakitte liste fiyati */
  alternatePriceKurus: number;
  /** 1 ise POS Favori Satis seridinde gosterilir */
  posFavorite: number;
}

export interface ProductInput {
  name: string;
  description: string;
  barcode: string;
  code: string;
  /** Adet: kurus/adet. Gram: 1000 g paket kurusu (UI TL / 1000 g). */
  priceKurus: number;
  /** Adet: kurus/adet. Gram: 1000 g paket maliyeti kurusu */
  costPriceKurus: number;
  discountPercent: number;
  stockQty: number;
  imagePath: string;
  categoryId: number;
  supplierId?: number;
  alternateSupplierIds?: number[];
  material?: string;
  vatRatePercent?: number;
  priceIncludesVat?: boolean;
  domesticMade?: boolean;
  pricedInUsd?: boolean;
  priceUsdCents?: number;
  costUsdCents?: number;
  /** Gelis kuru USD/TRY; pricedInUsd iken zorunlu sayilir */
  costUsdTryRate?: number;
  wholesalePriceKurus?: number;
  /** Kart odemede birim fiyat (kurus); bos/0 ise liste fiyati */
  alternatePriceKurus?: number;
  /** POS Favori Satis; 1 = favori */
  posFavorite?: number;
  /** Ilk stok aliminda odenmeyen kisim (kurus); tedarikci borcuna eklenir. Urun Ekle gidere yazmaz; gider Stok ekle ekranindadir. */
  initialStockRemainingDebtKurus?: number | null;
}

/** Satış satırı: isteğe bağlı birim fiyat (indirimler uygulanmış net kurus) */
export interface SaleLineInput {
  productId: number;
  qty: number;
  unitPriceKurus?: number;
  /** Gram satista: kurus/gram gelis (tartili satis); yoksa urun kartindaki maliyet */
  unitCostKurus?: number;
  /** Satir toplami (kurus). Ind.% / ozel tutar varsa birim*adet yerine bunu kullan. */
  lineTotalKurus?: number;
}

export type CategorySaleUnit = "piece" | "gram";

export interface Category {
  id: number;
  name: string;
  /** Adet: stok ve POS adet; Gram: stok ve POS gram */
  saleUnit: CategorySaleUnit;
}

export interface CategoryInput {
  name?: string;
  saleUnit?: CategorySaleUnit;
}

/** FIFO: urun basina maliyet partisi (once gelen once cikar) */
export interface StockCostLayer {
  id: number;
  productId: number;
  qtyRemaining: number;
  /** Adet veya 1000 g paket basina kurus */
  unitCostKurus: number;
  createdAt: string;
  stockMovementId?: number;
}

export interface Supplier {
  id: number;
  name: string;
  note: string;
  /** Iletisim / fatura icin (opsiyonel) */
  phone: string;
  email: string;
  address: string;
  district: string;
  city: string;
  taxOffice: string;
  taxNumber: string;
  /** Tedarikciye odenmemis / eksik odeme (kurus, >= 0) */
  balanceOwedKurus: number;
}

export interface SupplierInput {
  name: string;
  note?: string;
  phone?: string;
  email?: string;
  address?: string;
  district?: string;
  city?: string;
  taxOffice?: string;
  taxNumber?: string;
  balanceOwedKurus?: number;
}

export interface CartItem extends Product {
  qty: number;
}

export type CustomerKind = "wholesale" | "retail_regular";

export interface Customer {
  id: number;
  kind: CustomerKind;
  name: string;
  phone: string;
  note: string;
  /** E-posta (opsiyonel) */
  email: string;
  /** Toptanci: firma unvani (opsiyonel) */
  companyName: string;
  /** Fatura / iletisim adresi (opsiyonel) */
  address: string;
  district: string;
  city: string;
  /** TC veya VKN (opsiyonel) */
  taxOrVkn: string;
  /** Ödenmemiş / eksik tutar (kurus, >= 0) */
  balanceOwedKurus: number;
  /** Kasada musteriye uygulanan ek satir indirimi % (POS sepet fiyati) */
  suggestedDiscountPercent: number;
  createdAt: string;
}

export interface CustomerInput {
  kind?: CustomerKind;
  name?: string;
  phone?: string;
  note?: string;
  email?: string;
  companyName?: string;
  address?: string;
  district?: string;
  city?: string;
  taxOrVkn?: string;
  balanceOwedKurus?: number;
  suggestedDiscountPercent?: number;
}

export interface CustomerStats {
  customerId: number;
  transactionCount: number;
  netTotalKurus: number;
  lastTransactionAt: string | null;
}

/** Musteriye ozel urun birim fiyati (kurus/adet veya kurus/gram). */
export interface CustomerProductPrice {
  customerId: number;
  productId: number;
  priceKurus: number;
  updatedAt: string;
}

export interface CustomerProductPriceInput {
  productId: number;
  priceKurus: number;
}

export interface CustomerPurchaseRow {
  productId: number;
  productName: string;
  productCode: string;
  saleUnit: CategorySaleUnit;
  totalQty: number;
  totalRevenueKurus: number;
  transactionCount: number;
  lastPurchaseAt: string | null;
  /** Son alis satisinin ID (fatura icin) */
  lastSaleId: number | null;
}

export interface SupplierOverview {
  supplierId: number;
  products: Array<{
    productId: number;
    productName: string;
    productCode: string;
    stockQty: number;
    saleUnit: CategorySaleUnit;
  }>;
  stockEntries: StockEntryLogRow[];
}

export interface SaleRecord {
  id: number;
  createdAt: string;
  kind: SaleKind;
  cartName?: string;
  paymentType: PaymentType;
  subtotalKurus: number;
  /** Urun satirlari disi ek (orn. Kart Ozel) — kurus */
  extraFeeKurus?: number;
  paidAmountKurus: number;
  changeAmountKurus: number;
  /** Karma odeme: nakit kismi (kurus) */
  cashAmountKurus?: number;
  /** Karma odeme: kart kismi (kurus) */
  cardAmountKurus?: number;
  /** Bu satista musteriye eklenen eksik odeme borcu (kurus) */
  debtAddedKurus?: number;
  /** Bu satista mevcut borctan dusulen tutar (fazla tahsilat, kurus) */
  debtPaidKurus?: number;
  /** POS müşteri kartı (varsa) */
  customerId?: number;
  /** Borc odemesi / tahsilat notu */
  paymentNote?: string;
}

export interface SaleLineDetail {
  saleItemId?: number;
  productId: number;
  productName: string;
  productCode: string;
  qty: number;
  unitPriceKurus: number;
  lineTotalKurus: number;
  saleUnit: CategorySaleUnit;
}

export interface SaleWithLines {
  sale: SaleRecord;
  items: SaleLineDetail[];
}

export interface SaleHistoryListResult {
  sales: SaleRecord[];
  productIdsBySale: Record<number, number[]>;
}

export interface CartSalesSummary {
  cartName: string;
  salesCount: number;
  totalKurus: number;
  avgSaleKurus: number;
}

/** Bir gunluk satis satiri + maliyet (POS / kapanis) */
export interface DayProfitLine {
  saleItemId: number;
  saleId: number;
  saleCreatedAt: string;
  saleKind: SaleKind;
  productId: number;
  productName: string;
  productCode: string;
  qty: number;
  /** Gram: kurus/gram (satir maliyeti qty × bu deger). */
  unitCostKurus: number;
  /** Gram: kurus/gram satis fiyati */
  unitPriceKurus: number;
  lineCostKurus: number;
  lineTotalKurus: number;
  lineProfitKurus: number;
  saleUnit: CategorySaleUnit;
}

export interface DayProfitDetail {
  revenueKurus: number;
  costTotalKurus: number;
  profitKurus: number;
  lines: DayProfitLine[];
}

export interface MonthlyDayTotal {
  tarih: string;
  satisAdedi: number;
  ciroTl: number;
  maliyetTl: number;
  karTl: number;
}

export interface TopSellingProduct {
  productId: number;
  productName: string;
  productCode: string;
  qty: number;
  revenueKurus: number;
  /** Adet veya gramajli kategori */
  saleUnit: CategorySaleUnit;
}

export interface DashboardReport {
  productsCount: number;
  activeProductsCount: number;
  categoriesCount: number;
  lowStockCount: number;
  stockMovementsCount: number;
  closuresCount: number;
  salesCount: number;
  revenueKurus: number;
  costKurus: number;
  profitKurus: number;
  cashKurus: number;
  cardKurus: number;
  cartSummaries: CartSalesSummary[];
}

export interface BackupFileInfo {
  name: string;
  fullPath: string;
  size: number;
  createdAt: string;
}

export type { BackupModuleId, BackupModuleSelection, BackupInspectResult, BackupModuleStats } from "./backup";

export interface ErrorLogEntry {
  id: string;
  createdAt: string;
  level: "error" | "warn" | "info";
  message: string;
}

export interface Settings {
  openingTime: string;
  closureTime: string;
  lowStockThreshold: number;
  openingCashKurus: number;
  openingCashDate: string;
  /** Ust barda gorunen uygulama / isletme basligi */
  appTitle?: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  taxOffice: string;
  taxNumber: string;
  /** Uzaktan lisans: cihaz kimligi */
  licenseDeviceId?: string;
  /** Son basarili lisans kontrolu (ISO) */
  licenseLastOkAt?: string;
  /** Bir kez girilen lisans anahtari (gomulu) */
  licenseActivationKey?: string;
}

export interface InvoiceCustomerInfo {
  fullName: string;
  /** Toptanci alici unvani (opsiyonel) */
  companyName?: string;
  tcOrVkn?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  district?: string;
}

export interface StockAgingRow {
  productId: number;
  productName: string;
  productCode: string;
  stockQty: number;
  soldQty: number;
  avgDaysToSell: number | null;
  currentStockAgeDays: number | null;
}

export type StockCostMode = "product" | "invoice";

export interface StockAddInput {
  supplierId: number;
  costMode: StockCostMode;
  /** Urun bazli: birim gelis (kurus). Bos ise urun karti. */
  unitCostKurus?: number | null;
  /** Odenen fatura: toplam odenen tutar (kurus) */
  invoicePaidKurus?: number | null;
  /** false ise gelir-gidere yazilmaz (varsayilan true) */
  recordExpense?: boolean;
  /** Alis tutarindan odenmeyen kisim (kurus); tedarikci borcuna eklenir */
  remainingDebtKurus?: number | null;
  /** Gelen stok sepeti / fatura grubu (ayni batchId ile gecmiste gruplanir) */
  receiveBatchId?: string | null;
}

export type StockMovementKind = "in" | "out" | "adjust";

export interface StockMovementLogRow {
  movementId: number;
  createdAt: string;
  productId: number;
  productName: string;
  productCode: string;
  type: StockMovementKind;
  qty: number;
  note: string;
  saleUnit?: CategorySaleUnit;
}

export interface StockEntryLogRow {
  movementId: number;
  createdAt: string;
  productId: number;
  productName: string;
  productCode: string;
  qty: number;
  note: string;
  supplierId?: number;
  supplierName?: string;
  unitCostKurus?: number;
  lineCostKurus?: number;
  catalogLineCostKurus?: number;
  costMode?: StockCostMode;
  invoicePaidKurus?: number;
  amountPaidKurus?: number;
  debtAddedKurus?: number;
  cashflowEntryId?: number;
  saleUnit?: CategorySaleUnit;
  receiveBatchId?: string;
  /** Stok ekraninda Sil dugmesi (yalnizca gelen stok, urunun son girisi) */
  canDelete?: boolean;
}

/** Tütün / aroma kartlari (icerik bilgisi) */
export interface TobaccoAroma {
  id: number;
  name: string;
  content: string;
  imagePath: string;
  createdAt: string;
}

export interface TobaccoAromaInput {
  name: string;
  content: string;
  imagePath?: string;
}

export interface TobaccoAromaUpdate {
  name?: string;
  content?: string;
  imagePath?: string;
}

export type CashflowKind = "extra_income" | "expense_daily" | "expense_monthly";

/** Manuel gelir/gider satiri (POS satislari ayri hesaplanir) */
export interface CashflowEntry {
  id: number;
  kind: CashflowKind;
  /** YYYY-MM-DD */
  entryDate: string;
  /** expense_monthly: maliyetin yazildigi ay (YYYY-MM); diger turlerde genelde entryDate ile ayni ay */
  billingMonth: string;
  amountKurus: number;
  category: string;
  note: string;
  createdAt: string;
  /** Stok girisinden otomatik gider */
  stockMovementId?: number;
}

export interface CashflowEntryInput {
  kind: CashflowKind;
  /** extra_income / expense_daily icin zorunlu */
  entryDate?: string;
  /** expense_monthly icin zorunlu (YYYY-MM) */
  billingMonth?: string;
  amountKurus: number;
  category?: string;
  note?: string;
}

/** Secilen ay: satis neti + manuel kalemler */
export interface CashflowMonthlySummary {
  yearMonth: string;
  /** Ay icindeki satislarin subtotal + ek ucret toplami (iade negatif) */
  salesNetKurus: number;
  extraIncomeKurus: number;
  dailyExpenseKurus: number;
  /** Stok ekleme / ilk stoktan otomatik gunluk gider */
  stockPurchaseExpenseKurus: number;
  /** Gunluk gider icinde stok disi kalemler */
  otherDailyExpenseKurus: number;
  monthlyExpenseKurus: number;
  manualExpenseTotalKurus: number;
  totalInflowKurus: number;
  balanceKurus: number;
}

/** Ay sonu raporu: secilen ayin satis, kapanis, sepet, stok hareketi ve gelir-gider ozeti */
export interface MonthEndClosureRow {
  closureDate: string;
  totalSalesCount: number;
  grossRevenueKurus: number;
  costTotalKurus: number;
  profitKurus: number;
  cashTotalKurus: number;
  cardTotalKurus: number;
}

export interface MonthEndReport {
  yearMonth: string;
  /** Satis satirlari + (satis) ek ucretler toplami */
  revenueKurus: number;
  costKurus: number;
  profitKurus: number;
  salesCount: number;
  /** Ay icindeki stok hareketleri (adet giris/cikis/duzelt) */
  stockMovementsCount: number;
  cashKurus: number;
  cardKurus: number;
  closures: MonthEndClosureRow[];
  monthlyDayTotals: MonthlyDayTotal[];
  cartSummaries: CartSalesSummary[];
  topSelling: TopSellingProduct[];
  cashflow: CashflowMonthlySummary;
  cashflowEntries: CashflowEntry[];
}

/** Gunluk kapanis raporu (runClosure sonucu) */
/** PC yerel ag sunucusu — Android baglanti durumu */
export interface MobileLanStatus {
  enabled: boolean;
  running: boolean;
  host: string;
  port: number;
  tokenMasked: string;
  companyName: string;
  appVersion: string;
  apkAvailable: boolean;
  apkFilename: string;
  apkSizeBytes: number;
  apkDownloadUrl: string;
  apkInstallPageUrl: string;
}

/** QR kod icerigi (JSON string olarak kodlanir) */
export interface MobileLanPairPayload {
  v: 1;
  app: "marina-pos";
  host: string;
  port: number;
  token: string;
  name: string;
}

export interface ClosureRunResult {
  date: string;
  reportPath: string;
  totalSalesCount: number;
  cashTotalKurus: number;
  cardTotalKurus: number;
  grossRevenueKurus: number;
  costTotalKurus: number;
  profitKurus: number;
  saleLineCount: number;
  openingCashKurus: number;
  expectedCashKurus: number;
  actualCashKurus: number | null;
  cashDiffKurus: number | null;
}

declare global {
  interface Window {
    marinaApi: {
      listProducts: () => Promise<Product[]>;
      listStockCostLayers: () => Promise<StockCostLayer[]>;
      getProductById: (productId: number) => Promise<Product | null>;
      listCategories: () => Promise<Category[]>;
      createCategory: (name: string, saleUnit?: CategorySaleUnit) => Promise<Category>;
      updateCategory: (categoryId: number, patch: Partial<CategoryInput>) => Promise<Category | null>;
      listSuppliers: () => Promise<Supplier[]>;
      createSupplier: (payload: SupplierInput) => Promise<Supplier>;
      updateSupplier: (supplierId: number, patch: Partial<SupplierInput>) => Promise<Supplier | null>;
      deleteSupplier: (supplierId: number) => Promise<void>;
      createProduct: (payload: ProductInput) => Promise<void>;
      updateProduct: (productId: number, patch: Partial<ProductInput>) => Promise<void>;
      addStock: (productId: number, quantity: number, input: StockAddInput) => Promise<void>;
      nextReceiveBatchId: () => Promise<string>;
      adjustStock: (productId: number, countedQty: number, note?: string) => Promise<void>;
      lowStock: () => Promise<Product[]>;
      selectImage: (suggestedName?: string) => Promise<string>;
      getMediaDirectory: () => Promise<string>;
      readImageAsDataUrl: (fullPath: string) => Promise<string>;
      createSale: (
        items: SaleLineInput[],
        paymentType: PaymentType,
        paidAmount: number,
        kind?: SaleKind,
        cartName?: string,
        customerId?: number | null,
        extraFeeKurus?: number,
        paymentSplit?: PaymentSplitAmounts | null
      ) => Promise<void>;
      recordCustomerDebtPayment: (
        customerId: number,
        paymentType: PaymentType,
        amountKurus?: number,
        paymentNote?: string
      ) => Promise<SaleRecord>;
      listCustomers: () => Promise<Customer[]>;
      createCustomer: (payload: CustomerInput) => Promise<Customer>;
      updateCustomer: (customerId: number, patch: Partial<CustomerInput>) => Promise<Customer | null>;
      deleteCustomer: (customerId: number) => Promise<void>;
      getCustomerStats: (customerId: number) => Promise<CustomerStats | null>;
      getSalesForCustomer: (customerId: number, limit?: number) => Promise<SaleWithLines[]>;
      getCustomerPurchaseSummary: (customerId: number) => Promise<CustomerPurchaseRow[]>;
      listCustomerProductPrices: (customerId: number) => Promise<CustomerProductPrice[]>;
      setCustomerProductPrice: (customerId: number, productId: number, priceKurus: number) => Promise<void>;
      getSupplierOverview: (supplierId: number) => Promise<SupplierOverview | null>;
      recordSupplierDebtPayment: (
        supplierId: number,
        paymentType: PaymentType,
        amountKurus?: number,
        paymentNote?: string
      ) => Promise<void>;
      deleteProduct: (productId: number) => Promise<void>;
      deleteCategory: (categoryId: number) => Promise<void>;
      getSaleWithLines: (saleId: number) => Promise<SaleWithLines | null>;
      getRecentSalesWithLines: (date: string, limit?: number) => Promise<SaleWithLines[]>;
      openExternalUrl: (url: string) => Promise<void>;
      getDailySales: (date: string) => Promise<SaleRecord[]>;
      getDailySaleProductIds: (date: string) => Promise<Record<number, number[]>>;
      listSalesHistory: (limit?: number) => Promise<SaleHistoryListResult>;
      getDayProfitDetail: (date: string) => Promise<DayProfitDetail>;
      getMonthlyDayTotals: (yearMonth: string) => Promise<MonthlyDayTotal[]>;
      getTopSellingProducts: (limit?: number) => Promise<TopSellingProduct[]>;
      getDashboardReport: () => Promise<DashboardReport>;
      getStockAging: () => Promise<StockAgingRow[]>;
      getStockEntryLog: () => Promise<StockEntryLogRow[]>;
      getStockMovementLog: () => Promise<StockMovementLogRow[]>;
      deleteStockEntry: (movementId: number, productId?: number) => Promise<void>;
      deleteStockReceiveBatch: (receiveBatchId: string) => Promise<void>;
      getSettings: () => Promise<Settings>;
      setOpeningTime: (openingTime: string) => Promise<void>;
      setClosureTime: (closureTime: string) => Promise<void>;
      setOpeningCash: (amountKurus: number) => Promise<void>;
      setCompanyInfo: (patch: Partial<Settings>) => Promise<void>;
      createInvoice: (
        items: SaleLineInput[],
        paymentType: PaymentType,
        saleKind?: SaleKind,
        customer?: InvoiceCustomerInfo,
        extraFeeKurus?: number
      ) => Promise<string>;
      previewInvoice: (
        items: SaleLineInput[],
        paymentType: PaymentType,
        saleKind?: SaleKind,
        customer?: InvoiceCustomerInfo,
        extraFeeKurus?: number
      ) => Promise<string>;
      createBackup: (modules: BackupModuleId[]) => Promise<string>;
      getBackupModuleStats: () => Promise<BackupModuleStats>;
      listBackups: () => Promise<BackupFileInfo[]>;
      inspectBackupByName: (backupName: string) => Promise<BackupInspectResult>;
      inspectBackupFromJson: (jsonText: string) => Promise<BackupInspectResult>;
      restoreBackup: (backupName: string, modules: BackupModuleId[]) => Promise<void>;
      restoreBackupFromJson: (jsonText: string, modules: BackupModuleId[]) => Promise<void>;
      listLogs: (limit?: number) => Promise<ErrorLogEntry[]>;
      clearLogs: () => Promise<void>;
      addLog: (level: "error" | "warn" | "info", message: string) => Promise<void>;
      runClosure: (actualCashKurus?: number) => Promise<ClosureRunResult>;
      showItemInFolder: (fullPath: string) => Promise<void>;
      /** HTML etiket/fatura yazdir (Electron webContents.print) */
      printHtml?: (
        html: string,
        opts?: { widthMm?: number; heightMm?: number; title?: string }
      ) => Promise<{ ok: true } | { ok: false; error: string }>;
      exportXlsx: (date: string) => Promise<string>;
      exportMonthlyProfitXlsx: (yearMonth: string) => Promise<string>;
      listTobaccoAromas: () => Promise<TobaccoAroma[]>;
      createTobaccoAroma: (payload: TobaccoAromaInput) => Promise<TobaccoAroma>;
      updateTobaccoAroma: (id: number, payload: TobaccoAromaUpdate) => Promise<TobaccoAroma>;
      deleteTobaccoAroma: (id: number) => Promise<boolean>;
      listCashflowMonth: (yearMonth: string) => Promise<CashflowEntry[]>;
      getCashflowMonthlySummary: (yearMonth: string) => Promise<CashflowMonthlySummary>;
      createCashflowEntry: (payload: CashflowEntryInput) => Promise<CashflowEntry>;
      deleteCashflowEntry: (entryId: number) => Promise<void>;
      getMonthEndReport: (yearMonth: string) => Promise<MonthEndReport>;
      checkLicense: () => Promise<LicenseStatus>;
      activateLicense: (licenseKey: string) => Promise<LicenseStatus>;
      isFeedbackConfigured: () => Promise<boolean>;
      submitFeedback: (payload: FeedbackSubmitInput) => Promise<{ id: string }>;
      listFeedbackReplies: (companyName?: string) => Promise<FeedbackReplyItem[]>;
      listFeedbackForAccount: (accountEmail: string) => Promise<FeedbackReplyItem[]>;
      isAccountAuthConfigured: () => Promise<boolean>;
      getAccountAuthConfig: () => Promise<{ url: string; anonKey: string } | null>;
      isAssistantModelReady?: () => Promise<boolean>;
      downloadAssistantModel?: () => Promise<{ ok: boolean; error?: string }>;
      polishAssistantAnswer?: (question: string, coreAnswer: string) => Promise<string>;
      onAssistantDownloadProgress?: (callback: (progress: unknown) => void) => () => void;
      getAppUpdateInfo: () => Promise<AppUpdateInfo>;
      checkForAppUpdate: () => Promise<AppUpdateInfo>;
      downloadAppUpdate: () => Promise<AppUpdateInfo>;
      installAppUpdate: () => Promise<void>;
      onAppUpdateState?: (callback: (info: AppUpdateInfo) => void) => () => void;
      getMobileLanStatus: () => Promise<MobileLanStatus>;
      setMobileLanEnabled: (enabled: boolean) => Promise<MobileLanStatus>;
      regenerateMobileLanToken: () => Promise<MobileLanStatus>;
      getMobileLanPairPayload: () => Promise<MobileLanPairPayload>;
      getMobileLanQrDataUrl: () => Promise<string>;
      getMobileApkQrDataUrl: () => Promise<string>;
      posCartPull: () => Promise<import("./sharedPosCart").SharedPosCartSnapshot>;
      posCartPush: (payload: import("./sharedPosCart").SharedPosCartPushInput) => Promise<import("./sharedPosCart").SharedPosCartSnapshot>;
      posCartAckOps: (opIds: string[]) => Promise<import("./sharedPosCart").SharedPosCartSnapshot>;
      posCartClear: () => Promise<import("./sharedPosCart").SharedPosCartSnapshot>;
    };
  }
}
