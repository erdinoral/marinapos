import { loadEnvLocal } from "./loadEnvLocal";
loadEnvLocal();

import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { activateAndPersistLicense, checkAndPersistLicense } from "./licenseRuntime";
import { getSupabaseLicenseConfig } from "./licenseConfig";
import {
  submitAppFeedback,
  listAppFeedbackReplies,
  listAppFeedbackForAccount,
  type FeedbackSubmitInput
} from "../src/services/feedbackSupabase";
import { DatabaseService } from "../src/db/databaseService";
import { ClosureService } from "../src/features/closure/ClosureService";
import { ErrorLogService } from "../src/services/errorLogService";
import { exportMonthlyProfitToXlsx, exportSalesToXlsx } from "../src/services/exportService";
import { buildInvoiceHtml, createInvoiceHtml } from "../src/services/invoiceService";
import {
  CategorySaleUnit,
  CashflowEntryInput,
  CustomerInput,
  InvoiceCustomerInfo,
  PaymentType,
  ProductInput,
  SaleKind,
  Settings,
  StockAddInput,
  SupplierInput
} from "../src/types/models";
import { downloadAssistantModel, isAssistantModelReady, polishAssistantText } from "./assistantModelService";
import {
  checkForAppUpdate,
  downloadAppUpdate,
  getAppUpdateInfo,
  initAppUpdater,
  installAppUpdate
} from "./appUpdateService";

const isDev = !app.isPackaged;
/** Kurulu exe: yazilabilir ve guncellemelerden bagimsiz veri (genelde AppData\Roaming\...\data) */
const projectDataDir = app.isPackaged
  ? path.join(app.getPath("userData"), "data")
  : path.join(process.cwd(), "data");
const database = new DatabaseService(projectDataDir, app.getPath("userData"));
const errorLogs = new ErrorLogService(projectDataDir);
const closureService = new ClosureService(database, (result) => {
  console.log(`Kapanis tamamlandi: ${result.reportPath}`);
  app.quit();
});

process.on("uncaughtException", (e) => {
  errorLogs.add("error", `[uncaughtException] ${e instanceof Error ? e.stack || e.message : String(e)}`);
});
process.on("unhandledRejection", (reason) => {
  errorLogs.add("error", `[unhandledRejection] ${reason instanceof Error ? reason.stack || reason.message : String(reason)}`);
});

function createWindow() {
  const iconPath = isDev
    ? path.join(process.cwd(), "build", "icons", "icon.png")
    : path.join(app.getAppPath(), "build", "icons", "icon.png");
  const win = new BrowserWindow({
    width: 1500,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true
    }
  });
  win.maximize();

  /** Windows: baska uygulamadan donunce klavye bazen webview'e gitmez; alta alip acinca duzelir. */
  const refocusWebContents = () => {
    if (!win.isDestroyed() && win.isFocused()) {
      win.webContents.focus();
    }
  };
  win.on("focus", refocusWebContents);
  win.on("show", refocusWebContents);
  win.webContents.on("did-finish-load", refocusWebContents);

  win.on("close", () => {
    try {
      closureService.runClosureForToday();
    } catch {
      /* pencere kapanirken kapanis alinamazsa sessiz */
    }
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  database.init();
  try {
    const caught = closureService.catchUpMissingClosuresBeforeToday();
    if (caught.length > 0) {
      errorLogs.add("info", `[catch-up] Eksik gun kapanis tamamlandi: ${caught.map((r) => r.date).join(", ")}`);
    }
  } catch (e) {
    errorLogs.add("warn", `[catch-up] ${e instanceof Error ? e.message : String(e)}`);
  }
  closureService.startScheduler();
  initAppUpdater(errorLogs);
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("license:check", async () => checkAndPersistLicense(database.settings));
ipcMain.handle("license:activate", async (_, licenseKey: string) => {
  try {
    return await activateAndPersistLicense(database.settings, String(licenseKey ?? ""));
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Lisans aktivasyonu basarisiz.");
  }
});

ipcMain.handle("app-update:get-info", () => getAppUpdateInfo());
ipcMain.handle("app-update:check", () => checkForAppUpdate());
ipcMain.handle("app-update:download", () => downloadAppUpdate());
ipcMain.handle("app-update:install", () => {
  installAppUpdate();
});

ipcMain.handle("feedback:is-configured", () => Boolean(getSupabaseLicenseConfig()));
ipcMain.handle("feedback:submit", async (_, payload: FeedbackSubmitInput) => {
  const cfg = getSupabaseLicenseConfig();
  if (!cfg) {
    const err =
      "Supabase baglantisi yapilandirilmamis. Kurulumda build/supabase-license.json eksik olabilir.";
    errorLogs.add("error", `[feedback:submit] ${err}`);
    throw new Error(err);
  }
  const company = database.settings.get().companyName?.trim();
  const title = String(payload?.title ?? "").trim();
  try {
    const result = await submitAppFeedback(cfg, {
      ...payload,
      appVersion: app.getVersion(),
      companyName: payload.companyName?.trim() || company || undefined
    });
    errorLogs.add(
      "info",
      `[feedback:submit] OK id=${result.id} app=${cfg.appCode ?? "marina-pos"} title=${title.slice(0, 40)}`
    );
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errorLogs.add("error", `[feedback:submit] ${msg} | title=${title.slice(0, 40)}`);
    throw e;
  }
});
ipcMain.handle("feedback:list-replies", async (_, companyName?: string) => {
  const cfg = getSupabaseLicenseConfig();
  if (!cfg) return [];
  const company = String(companyName ?? "").trim() || database.settings.get().companyName?.trim() || "";
  if (!company) return [];
  return listAppFeedbackReplies(cfg, company);
});
ipcMain.handle("feedback:list-for-account", async (_, accountEmail?: string) => {
  const cfg = getSupabaseLicenseConfig();
  if (!cfg) return [];
  const email = String(accountEmail ?? "").trim();
  if (!email) return [];
  return listAppFeedbackForAccount(cfg, email);
});

ipcMain.handle("account:is-configured", () => Boolean(getSupabaseLicenseConfig()));
ipcMain.handle("account:get-auth-config", () => {
  const cfg = getSupabaseLicenseConfig();
  if (!cfg) return null;
  return { url: cfg.url.trim(), anonKey: cfg.anonKey.trim() };
});

ipcMain.handle("products:list", () => database.products.list());
ipcMain.handle("products:list-stock-cost-layers", () => database.products.listStockCostLayers());
ipcMain.handle("products:get-by-id", (_, productId: number) => database.products.getById(Number(productId)));
ipcMain.handle("categories:list", () => database.products.listCategories());
ipcMain.handle("categories:create", (_, name: string, saleUnit?: CategorySaleUnit) =>
  database.products.createCategory(name, saleUnit === "gram" ? "gram" : "piece")
);
ipcMain.handle("categories:update", (_, categoryId: number, patch: { name?: string; saleUnit?: CategorySaleUnit }) =>
  database.products.updateCategory(categoryId, patch ?? {})
);
ipcMain.handle("suppliers:list", () => database.products.listSuppliers());
ipcMain.handle("suppliers:create", (_, payload: SupplierInput) => database.products.createSupplier(payload ?? { name: "" }));
ipcMain.handle("suppliers:update", (_, supplierId: number, patch: Partial<SupplierInput>) =>
  database.products.updateSupplier(Number(supplierId), patch ?? {})
);
ipcMain.handle("suppliers:delete", (_, supplierId: number) => database.products.deleteSupplier(Number(supplierId)));
ipcMain.handle("products:create", (_, payload: ProductInput) => database.products.create(payload));
ipcMain.handle("products:update", (_, productId: number, patch: Partial<ProductInput>) => database.products.update(productId, patch));
ipcMain.handle("products:delete", (_, productId: number) => database.products.softDelete(productId));
ipcMain.handle("categories:delete", (_, categoryId: number) => database.products.deleteCategory(categoryId));
ipcMain.handle("products:add-stock", (_, productId: number, quantity: number, input: StockAddInput) =>
  database.products.addStock(productId, quantity, input ?? { supplierId: 0, costMode: "product" })
);
ipcMain.handle("products:next-receive-batch-id", () => database.products.nextReceiveBatchId());
ipcMain.handle("products:adjust-stock", (_, productId: number, countedQty: number, note = "") =>
  database.products.adjustStock(productId, countedQty, note)
);
ipcMain.handle("products:low-stock", () => database.products.lowStock());
ipcMain.handle("products:stock-entry-log", () => database.products.listStockEntryLog());
ipcMain.handle("products:delete-stock-entry", (_, movementId: number) => {
  database.products.deleteStockEntry(Number(movementId));
});
ipcMain.handle("media:select-image", async (_, suggestedName?: string) => {
  const result = await dialog.showOpenDialog({
    title: "Urun resmi sec",
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }]
  });
  if (result.canceled || result.filePaths.length === 0) return "";
  const sourcePath = result.filePaths[0];
  try {
    const mediaDir = path.join(projectDataDir, "media");
    fs.mkdirSync(mediaDir, { recursive: true });
    const ext = path.extname(sourcePath).toLowerCase();
    const preferred = String(suggestedName ?? "").trim();
    const rawBase = preferred || path.basename(sourcePath, ext);
    const safeBase = rawBase
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "image";
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const targetPath = path.join(mediaDir, `${safeBase}-${stamp}${ext || ".png"}`);
    fs.copyFileSync(sourcePath, targetPath);
    return targetPath;
  } catch {
    return sourcePath;
  }
});
ipcMain.handle("media:get-dir", () => path.join(projectDataDir, "media"));
ipcMain.handle("media:read-image-data-url", (_, fullPath: string) => {
  const p = String(fullPath ?? "").trim();
  if (!p) return "";
  try {
    const ext = path.extname(p).toLowerCase();
    const mime =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".webp"
            ? "image/webp"
            : ext === ".gif"
              ? "image/gif"
              : "";
    if (!mime) return "";
    const bin = fs.readFileSync(p);
    return `data:${mime};base64,${bin.toString("base64")}`;
  } catch {
    return "";
  }
});
ipcMain.handle(
  "sales:create",
  (
    _,
    items: Array<{ productId: number; qty: number }>,
    paymentType: PaymentType,
    paidAmount: number,
    kind: SaleKind = "sale",
    cartName = "Sepet 1",
    customerId: number | null | undefined = undefined,
    extraFeeKurus?: number
  ) => database.sales.create(items, paymentType, paidAmount, kind, cartName, customerId, Number(extraFeeKurus) || 0)
);
ipcMain.handle(
  "sales:record-debt-payment",
  (_, customerId: number, paymentType: PaymentType, amountKurus?: number | null, paymentNote?: string | null) =>
    database.sales.recordDebtPayment(
      Number(customerId),
      paymentType,
      amountKurus != null && Number.isFinite(Number(amountKurus)) ? Number(amountKurus) : undefined,
      paymentNote != null ? String(paymentNote) : undefined
    )
);
ipcMain.handle("customers:list", () => database.customers.list());
ipcMain.handle("customers:create", (_, payload: CustomerInput) => database.customers.create(payload));
ipcMain.handle("customers:update", (_, customerId: number, patch: Partial<CustomerInput>) =>
  database.customers.update(Number(customerId), patch ?? {})
);
ipcMain.handle("customers:delete", (_, customerId: number) => {
  database.customers.delete(Number(customerId));
});
ipcMain.handle("customers:stats", (_, customerId: number) => database.sales.getCustomerStats(Number(customerId)));
ipcMain.handle("customers:sales", (_, customerId: number, limit?: number) =>
  database.sales.getSalesForCustomer(Number(customerId), Number(limit ?? 24))
);
ipcMain.handle("customers:purchase-summary", (_, customerId: number) =>
  database.customers.getPurchaseSummary(Number(customerId))
);
ipcMain.handle("customers:product-prices", (_, customerId: number) =>
  database.customers.listProductPrices(Number(customerId))
);
ipcMain.handle("customers:set-product-price", (_, customerId: number, productId: number, priceKurus: number) => {
  database.customers.setProductPrice(Number(customerId), Number(productId), Number(priceKurus));
});
ipcMain.handle("suppliers:overview", (_, supplierId: number) =>
  database.products.getSupplierOverview(Number(supplierId))
);
ipcMain.handle(
  "suppliers:record-debt-payment",
  (_, supplierId: number, paymentType: PaymentType, amountKurus?: number | null, paymentNote?: string | null) => {
    database.products.recordSupplierDebtPayment(
      Number(supplierId),
      paymentType,
      amountKurus != null && Number.isFinite(Number(amountKurus)) ? Number(amountKurus) : undefined,
      paymentNote != null ? String(paymentNote) : undefined
    );
  }
);
ipcMain.handle("sales:daily", (_, date: string) => database.sales.getByDate(date));
ipcMain.handle("sales:daily-product-ids", (_, date: string) => database.sales.getProductIdsBySaleForDate(date));
ipcMain.handle("sales:detail", (_, saleId: number) => database.sales.getSaleWithLines(Number(saleId)));
ipcMain.handle("sales:recent-detail", (_, date: string, limit?: number) =>
  database.sales.getRecentSalesWithLines(String(date ?? ""), Number(limit ?? 5))
);
ipcMain.handle("sales:top-selling", (_, limit?: number) => database.sales.getTopSellingProducts(Number(limit ?? 8)));
ipcMain.handle("profit:day-detail", (_, date: string) => database.sales.getProfitDetailForDate(date));
ipcMain.handle("profit:monthly-day-totals", (_, yearMonth: string) => database.sales.getMonthlyDayTotals(yearMonth));
ipcMain.handle("reports:dashboard", () => database.sales.getDashboardReport());
ipcMain.handle("reports:month-end", (_, yearMonth: string) => database.getMonthEndReport(String(yearMonth ?? "")));
ipcMain.handle("stock:aging", () => database.sales.getStockAging());
ipcMain.handle("tobacco-aromas:list", () => database.tobaccoAromas.list());
ipcMain.handle("tobacco-aromas:create", (_, payload: { name: string; content: string; imagePath?: string }) =>
  database.tobaccoAromas.create(payload)
);
ipcMain.handle("tobacco-aromas:update", (_, id: number, payload: { name?: string; content?: string; imagePath?: string }) =>
  database.tobaccoAromas.update(Number(id), payload ?? {})
);
ipcMain.handle("tobacco-aromas:delete", (_, id: number) => database.tobaccoAromas.delete(Number(id)));
ipcMain.handle("cashflow:list-month", (_, yearMonth: string) => database.cashflow.listForMonth(String(yearMonth ?? "")));
ipcMain.handle("cashflow:summary-month", (_, yearMonth: string) => database.cashflow.getMonthlySummary(String(yearMonth ?? "")));
ipcMain.handle("cashflow:create", (_, payload: CashflowEntryInput) => database.cashflow.create(payload ?? ({} as CashflowEntryInput)));
ipcMain.handle("cashflow:delete", (_, entryId: number) => database.cashflow.delete(Number(entryId)));
ipcMain.handle("settings:get", () => database.settings.get());
ipcMain.handle("settings:set-opening-time", (_, openingTime: string) => database.settings.setOpeningTime(openingTime));
ipcMain.handle("settings:set-closure-time", (_, closureTime: string) => database.settings.setClosureTime(closureTime));
ipcMain.handle("settings:set-opening-cash", (_, amountKurus: number) => database.settings.setOpeningCash(amountKurus));
ipcMain.handle("settings:set-company-info", (_, patch: Partial<Settings>) => database.settings.setCompanyInfo(patch ?? {}));
ipcMain.handle("settings:create-backup", async (_, modules: string[]) => {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(
    now.getHours()
  ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  const defaultPath = path.join(app.getPath("documents"), `marina-pos-backup-${stamp}.json`);
  const result = await dialog.showSaveDialog({
    title: "Yedek dosyasini kaydet",
    defaultPath,
    filters: [{ name: "JSON", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePath) return "";
  return database.createBackup((modules ?? []) as import("../src/db/backupModules").BackupModuleId[], result.filePath);
});
ipcMain.handle("settings:list-backups", () => database.listBackups());
ipcMain.handle("settings:inspect-backup", (_, backupName: string) => database.inspectBackupByName(String(backupName ?? "")));
ipcMain.handle("settings:inspect-backup-json", (_, jsonText: string) => database.inspectBackupFromJson(String(jsonText ?? "")));
ipcMain.handle("settings:restore-backup", (_, backupName: string, modules: string[]) =>
  database.restoreBackup(String(backupName ?? ""), (modules ?? []) as import("../src/db/backupModules").BackupModuleId[])
);
ipcMain.handle("settings:restore-backup-json", (_, jsonText: string, modules: string[]) =>
  database.restoreFromJsonText(String(jsonText ?? ""), (modules ?? []) as import("../src/db/backupModules").BackupModuleId[])
);
ipcMain.handle("closures:run", (_, actualCashKurus?: number) => closureService.runClosureForToday(actualCashKurus));
ipcMain.handle("logs:list", (_, limit = 200) => errorLogs.list(Number(limit)));
ipcMain.handle("logs:clear", () => errorLogs.clear());
ipcMain.handle("logs:add", (_, level: "error" | "warn" | "info", message: string) => errorLogs.add(level, message));
ipcMain.handle(
  "invoice:create",
  (
    _,
    items: Array<{ productId: number; qty: number }>,
    paymentType: PaymentType,
    saleKind: SaleKind = "sale",
    customer?: InvoiceCustomerInfo,
    extraFeeKurus?: number
  ) => createInvoiceHtml(database, items, paymentType, saleKind, app.getPath("documents"), customer, Number(extraFeeKurus) || 0)
);
ipcMain.handle(
  "invoice:preview",
  (
    _,
    items: Array<{ productId: number; qty: number }>,
    paymentType: PaymentType,
    saleKind: SaleKind = "sale",
    customer?: InvoiceCustomerInfo,
    extraFeeKurus?: number
  ) => buildInvoiceHtml(database, items, paymentType, saleKind, customer, Number(extraFeeKurus) || 0).html
);
ipcMain.handle("shell:show-item-in-folder", (_, fullPath: string) => {
  if (fullPath) shell.showItemInFolder(path.normalize(fullPath));
});
ipcMain.handle("shell:open-external", (_, url: string) => {
  const u = String(url ?? "").trim();
  if (u.startsWith("tel:") || u.startsWith("mailto:")) {
    void shell.openExternal(u);
  }
});
ipcMain.handle("export:xlsx", (_, date: string) => exportSalesToXlsx(database, date, app.getPath("documents")));
ipcMain.handle("export:monthly-profit", (_, yearMonth: string) =>
  exportMonthlyProfitToXlsx(database, yearMonth, app.getPath("documents"))
);

ipcMain.handle("assistant:is-ready", () => isAssistantModelReady());

ipcMain.handle("assistant:download-model", async (event) => {
  const sender = event.sender;
  try {
    await downloadAssistantModel((progress) => {
      if (!sender.isDestroyed()) {
        sender.send("assistant:download-progress", progress);
      }
    });
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false as const, error: message };
  }
});

ipcMain.handle("assistant:polish", async (_, question: unknown, coreAnswer: unknown) => {
  const q = String(question ?? "");
  const a = String(coreAnswer ?? "");
  return polishAssistantText(q, a);
});
