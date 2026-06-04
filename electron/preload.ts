import { contextBridge, ipcRenderer } from "electron";
import {
  CategorySaleUnit,
  CashflowEntryInput,
  CustomerInput,
  FeedbackSubmitInput,
  InvoiceCustomerInfo,
  PaymentType,
  ProductInput,
  SaleKind,
  SaleLineInput,
  Settings,
  SupplierInput,
  TobaccoAromaInput,
  TobaccoAromaUpdate
} from "../src/types/models";

contextBridge.exposeInMainWorld("marinaApi", {
  listProducts: () => ipcRenderer.invoke("products:list"),
  listStockCostLayers: () => ipcRenderer.invoke("products:list-stock-cost-layers"),
  getProductById: (productId: number) => ipcRenderer.invoke("products:get-by-id", productId),
  listCategories: () => ipcRenderer.invoke("categories:list"),
  createCategory: (name: string, saleUnit?: CategorySaleUnit) =>
    ipcRenderer.invoke("categories:create", name, saleUnit ?? "piece"),
  updateCategory: (categoryId: number, patch: { name?: string; saleUnit?: CategorySaleUnit }) =>
    ipcRenderer.invoke("categories:update", categoryId, patch),
  listSuppliers: () => ipcRenderer.invoke("suppliers:list"),
  createSupplier: (payload: SupplierInput) => ipcRenderer.invoke("suppliers:create", payload),
  updateSupplier: (supplierId: number, patch: Partial<SupplierInput>) =>
    ipcRenderer.invoke("suppliers:update", supplierId, patch),
  deleteSupplier: (supplierId: number) => ipcRenderer.invoke("suppliers:delete", supplierId),
  createProduct: (payload: ProductInput) => ipcRenderer.invoke("products:create", payload),
  updateProduct: (productId: number, patch: Partial<ProductInput>) => ipcRenderer.invoke("products:update", productId, patch),
  deleteProduct: (productId: number) => ipcRenderer.invoke("products:delete", productId),
  deleteCategory: (categoryId: number) => ipcRenderer.invoke("categories:delete", categoryId),
  addStock: (productId: number, quantity: number, input: import("../src/types/models").StockAddInput) =>
    ipcRenderer.invoke("products:add-stock", productId, quantity, input),
  nextReceiveBatchId: () => ipcRenderer.invoke("products:next-receive-batch-id") as Promise<string>,
  adjustStock: (productId: number, countedQty: number, note = "") =>
    ipcRenderer.invoke("products:adjust-stock", productId, countedQty, note),
  lowStock: () => ipcRenderer.invoke("products:low-stock"),
  getStockEntryLog: () => ipcRenderer.invoke("products:stock-entry-log"),
  deleteStockEntry: (movementId: number) => ipcRenderer.invoke("products:delete-stock-entry", movementId),
  selectImage: (suggestedName?: string) => ipcRenderer.invoke("media:select-image", suggestedName ?? ""),
  getMediaDirectory: () => ipcRenderer.invoke("media:get-dir"),
  readImageAsDataUrl: (fullPath: string) => ipcRenderer.invoke("media:read-image-data-url", fullPath),
  createSale: (
    items: SaleLineInput[],
    paymentType: PaymentType,
    paidAmount: number,
    kind: SaleKind = "sale",
    cartName = "Sepet 1",
    customerId?: number | null,
    extraFeeKurus?: number
  ) =>
    ipcRenderer.invoke("sales:create", items, paymentType, paidAmount, kind, cartName, customerId ?? null, extraFeeKurus ?? 0),
  recordCustomerDebtPayment: (
    customerId: number,
    paymentType: PaymentType,
    amountKurus?: number,
    paymentNote?: string
  ) =>
    ipcRenderer.invoke("sales:record-debt-payment", customerId, paymentType, amountKurus ?? null, paymentNote ?? null),
  listCustomers: () => ipcRenderer.invoke("customers:list"),
  createCustomer: (payload: CustomerInput) => ipcRenderer.invoke("customers:create", payload),
  updateCustomer: (customerId: number, patch: Partial<CustomerInput>) =>
    ipcRenderer.invoke("customers:update", customerId, patch),
  deleteCustomer: (customerId: number) => ipcRenderer.invoke("customers:delete", customerId),
  getCustomerStats: (customerId: number) => ipcRenderer.invoke("customers:stats", customerId),
  getSalesForCustomer: (customerId: number, limit?: number) =>
    ipcRenderer.invoke("customers:sales", customerId, limit ?? 24),
  getCustomerPurchaseSummary: (customerId: number) => ipcRenderer.invoke("customers:purchase-summary", customerId),
  listCustomerProductPrices: (customerId: number) => ipcRenderer.invoke("customers:product-prices", customerId),
  setCustomerProductPrice: (customerId: number, productId: number, priceKurus: number) =>
    ipcRenderer.invoke("customers:set-product-price", customerId, productId, priceKurus),
  getSupplierOverview: (supplierId: number) => ipcRenderer.invoke("suppliers:overview", supplierId),
  recordSupplierDebtPayment: (
    supplierId: number,
    paymentType: PaymentType,
    amountKurus?: number,
    paymentNote?: string
  ) =>
    ipcRenderer.invoke(
      "suppliers:record-debt-payment",
      supplierId,
      paymentType,
      amountKurus ?? null,
      paymentNote ?? null
    ),
  getDailySales: (date: string) => ipcRenderer.invoke("sales:daily", date),
  getDailySaleProductIds: (date: string) => ipcRenderer.invoke("sales:daily-product-ids", date),
  getSaleWithLines: (saleId: number) => ipcRenderer.invoke("sales:detail", saleId),
  getRecentSalesWithLines: (date: string, limit = 5) => ipcRenderer.invoke("sales:recent-detail", date, limit),
  getDayProfitDetail: (date: string) => ipcRenderer.invoke("profit:day-detail", date),
  getMonthlyDayTotals: (yearMonth: string) => ipcRenderer.invoke("profit:monthly-day-totals", yearMonth),
  getTopSellingProducts: (limit = 8) => ipcRenderer.invoke("sales:top-selling", limit),
  getDashboardReport: () => ipcRenderer.invoke("reports:dashboard"),
  getMonthEndReport: (yearMonth: string) => ipcRenderer.invoke("reports:month-end", yearMonth),
  getStockAging: () => ipcRenderer.invoke("stock:aging"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setOpeningTime: (openingTime: string) => ipcRenderer.invoke("settings:set-opening-time", openingTime),
  setClosureTime: (closureTime: string) => ipcRenderer.invoke("settings:set-closure-time", closureTime),
  setOpeningCash: (amountKurus: number) => ipcRenderer.invoke("settings:set-opening-cash", amountKurus),
  setCompanyInfo: (patch: Partial<Settings>) => ipcRenderer.invoke("settings:set-company-info", patch),
  createBackup: (modules: string[]) => ipcRenderer.invoke("settings:create-backup", modules),
  listBackups: () => ipcRenderer.invoke("settings:list-backups"),
  inspectBackupByName: (backupName: string) => ipcRenderer.invoke("settings:inspect-backup", backupName),
  inspectBackupFromJson: (jsonText: string) => ipcRenderer.invoke("settings:inspect-backup-json", jsonText),
  restoreBackup: (backupName: string, modules: string[]) => ipcRenderer.invoke("settings:restore-backup", backupName, modules),
  restoreBackupFromJson: (jsonText: string, modules: string[]) =>
    ipcRenderer.invoke("settings:restore-backup-json", jsonText, modules),
  listLogs: (limit = 200) => ipcRenderer.invoke("logs:list", limit),
  clearLogs: () => ipcRenderer.invoke("logs:clear"),
  addLog: (level: "error" | "warn" | "info", message: string) => ipcRenderer.invoke("logs:add", level, message),
  createInvoice: (
    items: SaleLineInput[],
    paymentType: PaymentType,
    saleKind: SaleKind = "sale",
    customer?: InvoiceCustomerInfo,
    extraFeeKurus?: number
  ) => ipcRenderer.invoke("invoice:create", items, paymentType, saleKind, customer, extraFeeKurus ?? 0),
  previewInvoice: (
    items: SaleLineInput[],
    paymentType: PaymentType,
    saleKind: SaleKind = "sale",
    customer?: InvoiceCustomerInfo,
    extraFeeKurus?: number
  ) => ipcRenderer.invoke("invoice:preview", items, paymentType, saleKind, customer, extraFeeKurus ?? 0),
  openExternalUrl: (url: string) => ipcRenderer.invoke("shell:open-external", url),
  runClosure: (actualCashKurus?: number) => ipcRenderer.invoke("closures:run", actualCashKurus),
  showItemInFolder: (fullPath: string) => ipcRenderer.invoke("shell:show-item-in-folder", fullPath),
  exportXlsx: (date: string) => ipcRenderer.invoke("export:xlsx", date),
  exportMonthlyProfitXlsx: (yearMonth: string) => ipcRenderer.invoke("export:monthly-profit", yearMonth),
  listTobaccoAromas: () => ipcRenderer.invoke("tobacco-aromas:list"),
  createTobaccoAroma: (payload: TobaccoAromaInput) => ipcRenderer.invoke("tobacco-aromas:create", payload),
  updateTobaccoAroma: (id: number, payload: TobaccoAromaUpdate) => ipcRenderer.invoke("tobacco-aromas:update", id, payload),
  deleteTobaccoAroma: (id: number) => ipcRenderer.invoke("tobacco-aromas:delete", id),
  listCashflowMonth: (yearMonth: string) => ipcRenderer.invoke("cashflow:list-month", yearMonth),
  getCashflowMonthlySummary: (yearMonth: string) => ipcRenderer.invoke("cashflow:summary-month", yearMonth),
  createCashflowEntry: (payload: CashflowEntryInput) => ipcRenderer.invoke("cashflow:create", payload),
  deleteCashflowEntry: (entryId: number) => ipcRenderer.invoke("cashflow:delete", entryId),
  checkLicense: () => ipcRenderer.invoke("license:check"),
  activateLicense: (licenseKey: string) => ipcRenderer.invoke("license:activate", licenseKey),
  isFeedbackConfigured: () => ipcRenderer.invoke("feedback:is-configured"),
  submitFeedback: (payload: FeedbackSubmitInput) => ipcRenderer.invoke("feedback:submit", payload),
  listFeedbackReplies: (companyName?: string) => ipcRenderer.invoke("feedback:list-replies", companyName),
  listFeedbackForAccount: (accountEmail: string) => ipcRenderer.invoke("feedback:list-for-account", accountEmail),
  isAccountAuthConfigured: () => ipcRenderer.invoke("account:is-configured"),
  getAccountAuthConfig: () => ipcRenderer.invoke("account:get-auth-config"),
  isAssistantModelReady: () => ipcRenderer.invoke("assistant:is-ready"),
  downloadAssistantModel: () => ipcRenderer.invoke("assistant:download-model"),
  polishAssistantAnswer: (question: string, coreAnswer: string) =>
    ipcRenderer.invoke("assistant:polish", question, coreAnswer),
  onAssistantDownloadProgress: (callback: (progress: unknown) => void) => {
    const handler = (_event: unknown, progress: unknown) => callback(progress);
    ipcRenderer.on("assistant:download-progress", handler);
    return () => ipcRenderer.removeListener("assistant:download-progress", handler);
  },
  getAppUpdateInfo: () => ipcRenderer.invoke("app-update:get-info"),
  checkForAppUpdate: () => ipcRenderer.invoke("app-update:check"),
  downloadAppUpdate: () => ipcRenderer.invoke("app-update:download"),
  installAppUpdate: () => ipcRenderer.invoke("app-update:install"),
  onAppUpdateState: (callback: (info: import("../src/types/models").AppUpdateInfo) => void) => {
    const handler = (_event: unknown, info: import("../src/types/models").AppUpdateInfo) => callback(info);
    ipcRenderer.on("app-update:state", handler);
    return () => ipcRenderer.removeListener("app-update:state", handler);
  }
});
