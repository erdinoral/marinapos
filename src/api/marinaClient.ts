import type {
  CategorySaleUnit,
  CashflowEntryInput,
  StockAddInput,
  CustomerInput,
  FeedbackSubmitInput,
  PaymentType,
  ProductInput,
  SaleKind,
  SaleLineInput,
  SupplierInput,
  TobaccoAromaInput,
  TobaccoAromaUpdate
} from "../types/models";

type MarinaApi = Window["marinaApi"];

async function devInvoke<T>(channel: string, args: unknown[] = []): Promise<T> {
  const res = await fetch("/__marina/ipc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel, args })
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `Sunucu hatasi (${res.status})`);
  }
  if (text === "" || text === "null") {
    return null as T;
  }
  return JSON.parse(text) as T;
}

/** Vite dev (Electron yokken): marinaDevIpcPlugin uzerinden gercek JsonStore — stok dahil tum veri data/marina-pos.json */
function createDevServerMarinaApi(): MarinaApi {
  return {
    listProducts: () => devInvoke("products:list"),
    listStockCostLayers: () => devInvoke("products:list-stock-cost-layers"),
    getProductById: (productId) => devInvoke("products:get-by-id", [productId]),
    listCategories: () => devInvoke("categories:list"),
    createCategory: (name, saleUnit?: CategorySaleUnit) =>
      devInvoke("categories:create", [name, saleUnit ?? "piece"]),
    updateCategory: (categoryId, patch) => devInvoke("categories:update", [categoryId, patch]),
    listSuppliers: () => devInvoke("suppliers:list"),
    createSupplier: (payload: SupplierInput) => devInvoke("suppliers:create", [payload]),
    updateSupplier: (supplierId: number, patch: Partial<SupplierInput>) =>
      devInvoke("suppliers:update", [supplierId, patch]),
    deleteSupplier: (supplierId) => devInvoke("suppliers:delete", [supplierId]),
    createProduct: (payload) => devInvoke("products:create", [payload]),
    updateProduct: (productId, patch) => devInvoke("products:update", [productId, patch]),
    deleteProduct: (productId) => devInvoke("products:delete", [productId]),
    deleteCategory: (categoryId) => devInvoke("categories:delete", [categoryId]),
    addStock: (productId, quantity, input: StockAddInput) =>
      devInvoke("products:add-stock", [productId, quantity, input]),
    nextReceiveBatchId: () => devInvoke("products:next-receive-batch-id"),
    adjustStock: (productId, countedQty, note = "") =>
      devInvoke("products:adjust-stock", [productId, countedQty, note]),
    lowStock: () => devInvoke("products:low-stock"),
    getStockEntryLog: () => devInvoke("products:stock-entry-log"),
    getStockMovementLog: () => devInvoke("products:stock-movement-log"),
    deleteStockEntry: (movementId: number, productId?: number) =>
      devInvoke("products:delete-stock-entry", [movementId, productId]),
    deleteStockReceiveBatch: (receiveBatchId: string) =>
      devInvoke("products:delete-stock-receive-batch", [receiveBatchId]),
    selectImage: (suggestedName?: string) => devInvoke("media:select-image", [suggestedName ?? ""]),
    getMediaDirectory: () => devInvoke("media:get-dir"),
    readImageAsDataUrl: (fullPath) => devInvoke("media:read-image-data-url", [fullPath]),
    createSale: (
      items: SaleLineInput[],
      paymentType,
      paidAmount,
      kind: SaleKind = "sale",
      cartName = "Sepet 1",
      customerId?: number | null,
      extraFeeKurus?: number,
      paymentSplit?: { cashAmountKurus: number; cardAmountKurus: number } | null
    ) =>
      devInvoke("sales:create", [
        items,
        paymentType,
        paidAmount,
        kind,
        cartName,
        customerId ?? null,
        extraFeeKurus ?? 0,
        paymentSplit ?? null
      ]),
    recordCustomerDebtPayment: (
      customerId: number,
      paymentType: PaymentType,
      amountKurus?: number,
      paymentNote?: string
    ) => devInvoke("sales:record-debt-payment", [customerId, paymentType, amountKurus ?? null, paymentNote ?? null]),
    listCustomers: () => devInvoke("customers:list"),
    createCustomer: (payload: CustomerInput) => devInvoke("customers:create", [payload]),
    updateCustomer: (customerId: number, patch: Partial<CustomerInput>) =>
      devInvoke("customers:update", [customerId, patch]),
    deleteCustomer: (customerId: number) => devInvoke("customers:delete", [customerId]),
    getCustomerStats: (customerId: number) => devInvoke("customers:stats", [customerId]),
    getSalesForCustomer: (customerId: number, limit = 24) => devInvoke("customers:sales", [customerId, limit]),
    getCustomerPurchaseSummary: (customerId: number) => devInvoke("customers:purchase-summary", [customerId]),
    listCustomerProductPrices: (customerId: number) => devInvoke("customers:product-prices", [customerId]),
    setCustomerProductPrice: (customerId: number, productId: number, priceKurus: number) =>
      devInvoke("customers:set-product-price", [customerId, productId, priceKurus]),
    getSupplierOverview: (supplierId: number) => devInvoke("suppliers:overview", [supplierId]),
    recordSupplierDebtPayment: (
      supplierId: number,
      paymentType: PaymentType,
      amountKurus?: number,
      paymentNote?: string
    ) =>
      devInvoke("suppliers:record-debt-payment", [supplierId, paymentType, amountKurus ?? null, paymentNote ?? null]),
    getDailySales: (date) => devInvoke("sales:daily", [date]),
    getDailySaleProductIds: (date) => devInvoke("sales:daily-product-ids", [date]),
    listSalesHistory: (limit = 0) => devInvoke("sales:history", [limit]),
    getSaleWithLines: (saleId) => devInvoke("sales:detail", [saleId]),
    getRecentSalesWithLines: (date, limit = 5) => devInvoke("sales:recent-detail", [date, limit]),
    getTopSellingProducts: (limit = 8) => devInvoke("sales:top-selling", [limit]),
    getDayProfitDetail: (date) => devInvoke("profit:day-detail", [date]),
    getMonthlyDayTotals: (yearMonth) => devInvoke("profit:monthly-day-totals", [yearMonth]),
    getDashboardReport: () => devInvoke("reports:dashboard"),
    getMonthEndReport: (yearMonth: string) => devInvoke("reports:month-end", [yearMonth]),
    getStockAging: () => devInvoke("stock:aging"),
    getSettings: () => devInvoke("settings:get"),
    setOpeningTime: (openingTime) => devInvoke("settings:set-opening-time", [openingTime]),
    setClosureTime: (closureTime) => devInvoke("settings:set-closure-time", [closureTime]),
    setOpeningCash: (amountKurus) => devInvoke("settings:set-opening-cash", [amountKurus]),
    setCompanyInfo: (patch) => devInvoke("settings:set-company-info", [patch]),
    createBackup: (modules) => devInvoke("settings:create-backup", [modules]),
    getBackupModuleStats: () => devInvoke("settings:backup-stats"),
    listBackups: () => devInvoke("settings:list-backups"),
    inspectBackupByName: (backupName) => devInvoke("settings:inspect-backup", [backupName]),
    inspectBackupFromJson: (jsonText) => devInvoke("settings:inspect-backup-json", [jsonText]),
    restoreBackup: (backupName, modules) => devInvoke("settings:restore-backup", [backupName, modules]),
    restoreBackupFromJson: (jsonText, modules) => devInvoke("settings:restore-backup-json", [jsonText, modules]),
    listLogs: (limit = 200) => devInvoke("logs:list", [limit]),
    clearLogs: () => devInvoke("logs:clear"),
    addLog: (level, message) => devInvoke("logs:add", [level, message]),
    createInvoice: (items: SaleLineInput[], paymentType, saleKind = "sale", customer, extraFeeKurus?: number) =>
      devInvoke("invoice:create", [items, paymentType, saleKind, customer, extraFeeKurus ?? 0]),
    previewInvoice: (items: SaleLineInput[], paymentType, saleKind = "sale", customer, extraFeeKurus?: number) =>
      devInvoke("invoice:preview", [items, paymentType, saleKind, customer, extraFeeKurus ?? 0]),
    openExternalUrl: (url) => devInvoke("shell:open-external", [url]),
    runClosure: (actualCashKurus) => devInvoke("closures:run", [actualCashKurus]),
    showItemInFolder: (fullPath) => devInvoke("shell:show-item-in-folder", [fullPath]),
    exportXlsx: (date) => devInvoke("export:xlsx", [date]),
    exportMonthlyProfitXlsx: (yearMonth) => devInvoke("export:monthly-profit", [yearMonth]),
    listTobaccoAromas: () => devInvoke("tobacco-aromas:list"),
    createTobaccoAroma: (payload: TobaccoAromaInput) => devInvoke("tobacco-aromas:create", [payload]),
    updateTobaccoAroma: (id: number, payload: TobaccoAromaUpdate) => devInvoke("tobacco-aromas:update", [id, payload]),
    deleteTobaccoAroma: (id: number) => devInvoke("tobacco-aromas:delete", [id]),
    listCashflowMonth: (yearMonth: string) => devInvoke("cashflow:list-month", [yearMonth]),
    getCashflowMonthlySummary: (yearMonth: string) => devInvoke("cashflow:summary-month", [yearMonth]),
    createCashflowEntry: (payload: CashflowEntryInput) => devInvoke("cashflow:create", [payload]),
    deleteCashflowEntry: (entryId: number) => devInvoke("cashflow:delete", [entryId]),
    checkLicense: () => devInvoke("license:check", []),
    activateLicense: (licenseKey: string) => devInvoke("license:activate", [licenseKey]),
    isFeedbackConfigured: () => devInvoke("feedback:is-configured", []),
    submitFeedback: (payload: FeedbackSubmitInput) => devInvoke("feedback:submit", [payload]),
    listFeedbackReplies: (companyName?: string) => devInvoke("feedback:list-replies", [companyName ?? ""]),
    listFeedbackForAccount: (accountEmail: string) => devInvoke("feedback:list-for-account", [accountEmail]),
    isAccountAuthConfigured: () => devInvoke("account:is-configured", []),
    getAccountAuthConfig: () => devInvoke("account:get-auth-config", []),
    getAppUpdateInfo: () => devInvoke("app-update:get-info", []),
    checkForAppUpdate: () => devInvoke("app-update:check", []),
    downloadAppUpdate: () => devInvoke("app-update:download", []),
    installAppUpdate: () => devInvoke("app-update:install", []),
    getMobileLanStatus: () => devInvoke("mobile:get-status"),
    setMobileLanEnabled: (enabled: boolean) => devInvoke("mobile:set-enabled", [enabled]),
    regenerateMobileLanToken: () => devInvoke("mobile:regenerate-token"),
    getMobileLanPairPayload: () => devInvoke("mobile:get-pair-payload"),
    getMobileLanQrDataUrl: () => devInvoke("mobile:get-qr-dataurl"),
    getMobileApkQrDataUrl: () => devInvoke("mobile:get-apk-qr-dataurl"),
    posCartPull: () => devInvoke("pos-cart:pull"),
    posCartPush: (payload) => devInvoke("pos-cart:push", [payload]),
    posCartAckOps: (opIds: string[]) => devInvoke("pos-cart:ack-ops", [opIds]),
    posCartClear: () => devInvoke("pos-cart:clear"),
    printHtml: (html, opts) => devInvoke("print:html", [html, opts ?? {}])
  };
}

let cached: MarinaApi | null = null;

export function getMarinaApi(): MarinaApi {
  if (cached) {
    return cached;
  }
  if (typeof window !== "undefined" && window.marinaApi) {
    cached = window.marinaApi;
    return cached;
  }
  if (typeof window !== "undefined") {
    cached = createDevServerMarinaApi();
    return cached;
  }
  throw new Error("Marina API yok. Uygulamayi Electron ile acin: npm run dev veya npm start.");
}
