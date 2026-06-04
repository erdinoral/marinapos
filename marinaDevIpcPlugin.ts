import { execFileSync } from "node:child_process";
import fs from "node:fs";
import type { IncomingMessage } from "node:http";
import path from "node:path";
import type { Plugin } from "vite";
import { DatabaseService } from "./src/db/databaseService";
import { ClosureService } from "./src/features/closure/ClosureService";
import { ErrorLogService } from "./src/services/errorLogService";
import { exportMonthlyProfitToXlsx, exportSalesToXlsx } from "./src/services/exportService";
import { buildInvoiceHtml, createInvoiceHtml } from "./src/services/invoiceService";
import { githubReleasesPageUrl } from "./src/config/githubRelease";
import { LICENSE_APP_CODE } from "./src/config/licenseApp";
import { readSupabaseCredentialsFromEnv } from "./src/config/supabaseEnv";
import { loadEnvLocal } from "./electron/loadEnvLocal";
import { activateLicenseKey, runLicenseCheck } from "./src/services/licenseService";
import {
  submitAppFeedback,
  listAppFeedbackReplies,
  listAppFeedbackForAccount,
  type FeedbackSubmitInput
} from "./src/services/feedbackSupabase";
import {
  isSupabaseLicenseConfig,
  normalizeLicenseKey,
  resolveAppCode,
  type SupabaseLicenseConfig
} from "./src/services/licenseSupabase";
import type {
  AppUpdateInfo,
  CategorySaleUnit,
  CashflowEntryInput,
  CustomerInput,
  InvoiceCustomerInfo,
  PaymentType,
  ProductInput,
  SaleKind,
  SupplierInput,
  StockAddInput,
  TobaccoAromaInput,
  TobaccoAromaUpdate
} from "./src/types/models";

function devAppUpdateInfo(): AppUpdateInfo {
  return {
    enabled: false,
    devMode: true,
    currentVersion: process.env.npm_package_version ?? "dev",
    phase: "idle",
    releasePageUrl: githubReleasesPageUrl(),
    error: "Guncelleme yalnizca kurulu uygulamada (Setup.exe) kullanilir."
  };
}

function readDevLicenseRegistryUrl(): string {
  const fromEnv = String(process.env.MARINA_LICENSE_URL ?? "").trim();
  if (fromEnv) return fromEnv;
  const p = path.join(process.cwd(), "build", "license-registry.url");
  try {
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8").trim();
  } catch {
    /* ignore */
  }
  return "";
}

function readDevSupabaseLicenseConfig(): SupabaseLicenseConfig | null {
  loadEnvLocal();
  const { url, anonKey } = readSupabaseCredentialsFromEnv();
  if (url && anonKey) {
    return {
      url,
      anonKey,
      appCode: process.env.MARINA_LICENSE_APP_CODE ?? LICENSE_APP_CODE
    };
  }
  const p = path.join(process.cwd(), "build", "supabase-license.json");
  try {
    if (!fs.existsSync(p)) return null;
    const parsed = JSON.parse(fs.readFileSync(p, "utf8")) as unknown;
    if (!isSupabaseLicenseConfig(parsed)) return null;
    return {
      ...parsed,
      appCode: process.env.MARINA_LICENSE_APP_CODE ?? parsed.appCode ?? LICENSE_APP_CODE
    };
  } catch {
    return null;
  }
}

function devLicenseAppCode(supabase: SupabaseLicenseConfig | null): string {
  return supabase ? resolveAppCode(supabase) : LICENSE_APP_CODE;
}

function devDeviceBindRequired(): boolean {
  return String(process.env.MARINA_LICENSE_BIND_DEVICE ?? "").trim() === "1";
}

async function devCheckLicense(db: DatabaseService) {
  const supabase = readDevSupabaseLicenseConfig();
  const url = supabase ? "" : readDevLicenseRegistryUrl();
  const configured = Boolean(supabase || url);
  const bypass = process.env.MARINA_SKIP_LICENSE === "1" || !configured;
  const s = db.settings.get();
  const { status, newLastOkAt, newDeviceId, newActivationKey } = await runLicenseCheck({
    registryUrl: url,
    supabase,
    licenseAppCode: devLicenseAppCode(supabase),
    deviceId: s.licenseDeviceId ?? "",
    activationKey: s.licenseActivationKey ?? "",
    lastOkAt: s.licenseLastOkAt || null,
    isDevBypass: bypass,
    deviceBindRequired: devDeviceBindRequired()
  });
  db.settings.setLicenseMeta({
    deviceId: newDeviceId,
    lastOkAt: newLastOkAt,
    activationKey: newActivationKey ?? s.licenseActivationKey ?? ""
  });
  return status;
}

async function devActivateLicense(db: DatabaseService, licenseKeyRaw: string) {
  const supabase = readDevSupabaseLicenseConfig();
  if (!supabase) throw new Error("Supabase yapilandirilmadi (.env.local veya build/supabase-license.json).");
  const s = db.settings.get();
  const licenseKey = normalizeLicenseKey(licenseKeyRaw);
  const { status, newLastOkAt, newDeviceId, newActivationKey } = await activateLicenseKey({
    supabase,
    licenseKey,
    deviceId: s.licenseDeviceId ?? "",
    lastOkAt: s.licenseLastOkAt || null,
    licenseAppCode: devLicenseAppCode(supabase),
    deviceBindRequired: devDeviceBindRequired()
  });
  db.settings.setLicenseMeta({
    deviceId: newDeviceId,
    lastOkAt: newLastOkAt,
    activationKey: newActivationKey
  });
  return status;
}

function showItemInFolderDev(fullPath: string) {
  if (!fullPath) return;
  const normalized = path.normalize(fullPath);
  try {
    if (process.platform === "win32") {
      execFileSync("explorer.exe", ["/select,", normalized], { windowsHide: true });
    } else if (process.platform === "darwin") {
      execFileSync("open", ["-R", normalized]);
    } else {
      execFileSync("xdg-open", [path.dirname(normalized)]);
    }
  } catch {
    /* explorer acilmazsa sessiz */
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (ch) => chunks.push(ch as Buffer));
    req.on("end", () => resolve(chunks.length ? Buffer.concat(chunks).toString("utf-8") : ""));
    req.on("error", reject);
  });
}

function dispatch(db: DatabaseService, logs: ErrorLogService, channel: string, args: unknown[]): unknown {
  switch (channel) {
    case "products:list":
      return db.products.list();
    case "products:list-stock-cost-layers":
      return db.products.listStockCostLayers();
    case "products:get-by-id":
      return db.products.getById(Number(args[0]));
    case "categories:list":
      return db.products.listCategories();
    case "categories:create": {
      const su = (args[1] as CategorySaleUnit | undefined) === "gram" ? "gram" : "piece";
      return db.products.createCategory(String(args[0] ?? ""), su);
    }
    case "categories:update":
      return db.products.updateCategory(Number(args[0]), (args[1] ?? {}) as { name?: string; saleUnit?: CategorySaleUnit });
    case "suppliers:list":
      return db.products.listSuppliers();
    case "suppliers:create":
      return db.products.createSupplier((args[0] ?? { name: "" }) as SupplierInput);
    case "suppliers:update":
      return db.products.updateSupplier(Number(args[0]), (args[1] ?? {}) as Partial<SupplierInput>);
    case "suppliers:delete":
      return db.products.deleteSupplier(Number(args[0]));
    case "products:create":
      return db.products.create(args[0] as ProductInput);
    case "products:update":
      return db.products.update(Number(args[0]), (args[1] ?? {}) as Partial<ProductInput>);
    case "products:delete":
      return db.products.softDelete(Number(args[0]));
    case "categories:delete":
      return db.products.deleteCategory(Number(args[0]));
    case "products:add-stock":
      return db.products.addStock(Number(args[0]), Number(args[1]), (args[2] ?? {}) as StockAddInput);
    case "products:adjust-stock":
      return db.products.adjustStock(Number(args[0]), Number(args[1]), String(args[2] ?? ""));
    case "products:low-stock":
      return db.products.lowStock();
    case "products:stock-entry-log":
      return db.products.listStockEntryLog();
    case "products:delete-stock-entry":
      db.products.deleteStockEntry(Number(args[0]));
      return undefined;
    case "media:select-image":
      return "";
    case "media:get-dir":
      return path.join(process.cwd(), "data", "media");
    case "media:read-image-data-url": {
      const p = String(args[0] ?? "").trim();
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
    }
    case "sales:create":
      return db.sales.create(
        args[0] as Array<{ productId: number; qty: number; unitPriceKurus?: number }>,
        args[1] as PaymentType,
        Number(args[2]),
        ((args[3] as SaleKind | undefined) ?? "sale") as SaleKind,
        String(args[4] ?? "Sepet 1"),
        args[5] as number | null | undefined,
        Number(args[6]) || 0
      );
    case "sales:record-debt-payment":
      return db.sales.recordDebtPayment(
        Number(args[0]),
        args[1] as PaymentType,
        args[2] != null && Number.isFinite(Number(args[2])) ? Number(args[2]) : undefined
      );
    case "customers:list":
      return db.customers.list();
    case "customers:create":
      return db.customers.create(args[0] as CustomerInput);
    case "customers:update":
      return db.customers.update(Number(args[0]), (args[1] ?? {}) as Partial<CustomerInput>);
    case "customers:delete":
      db.customers.delete(Number(args[0]));
      return undefined;
    case "customers:stats":
      return db.sales.getCustomerStats(Number(args[0]));
    case "customers:sales":
      return db.sales.getSalesForCustomer(Number(args[0]), Number(args[1] ?? 24));
    case "customers:purchase-summary":
      return db.customers.getPurchaseSummary(Number(args[0]));
    case "customers:product-prices":
      return db.customers.listProductPrices(Number(args[0]));
    case "customers:set-product-price":
      db.customers.setProductPrice(Number(args[0]), Number(args[1]), Number(args[2]));
      return undefined;
    case "suppliers:overview":
      return db.products.getSupplierOverview(Number(args[0]));
    case "sales:daily":
      return db.sales.getByDate(String(args[0] ?? ""));
    case "sales:daily-product-ids":
      return db.sales.getProductIdsBySaleForDate(String(args[0] ?? ""));
    case "sales:detail":
      return db.sales.getSaleWithLines(Number(args[0]));
    case "sales:recent-detail":
      return db.sales.getRecentSalesWithLines(String(args[0] ?? ""), Number(args[1] ?? 5));
    case "sales:top-selling":
      return db.sales.getTopSellingProducts(Number(args[0] ?? 8));
    case "profit:day-detail":
      return db.sales.getProfitDetailForDate(String(args[0] ?? ""));
    case "profit:monthly-day-totals":
      return db.sales.getMonthlyDayTotals(String(args[0] ?? ""));
    case "reports:dashboard":
      return db.sales.getDashboardReport();
    case "reports:month-end":
      return db.getMonthEndReport(String(args[0] ?? ""));
    case "stock:aging":
      return db.sales.getStockAging();
    case "tobacco-aromas:list":
      return db.tobaccoAromas.list();
    case "tobacco-aromas:create":
      return db.tobaccoAromas.create((args[0] ?? {}) as TobaccoAromaInput);
    case "tobacco-aromas:update":
      return db.tobaccoAromas.update(Number(args[0]), (args[1] ?? {}) as TobaccoAromaUpdate);
    case "tobacco-aromas:delete":
      return db.tobaccoAromas.delete(Number(args[0]));
    case "cashflow:list-month":
      return db.cashflow.listForMonth(String(args[0] ?? ""));
    case "cashflow:summary-month":
      return db.cashflow.getMonthlySummary(String(args[0] ?? ""));
    case "cashflow:create":
      return db.cashflow.create((args[0] ?? {}) as CashflowEntryInput);
    case "cashflow:delete":
      return db.cashflow.delete(Number(args[0]));
    case "license:check":
      return devCheckLicense(db);
    case "license:activate":
      return devActivateLicense(db, String(args[0] ?? ""));
    case "feedback:is-configured":
      return Boolean(readDevSupabaseLicenseConfig());
    case "feedback:submit": {
      const cfg = readDevSupabaseLicenseConfig();
      if (!cfg) throw new Error("Supabase yapilandirilmadi (.env.local veya build/supabase-license.json).");
      const payload = (args[0] ?? {}) as FeedbackSubmitInput;
      const company = db.settings.get().companyName?.trim();
      return submitAppFeedback(cfg, {
        ...payload,
        appVersion: process.env.npm_package_version ?? "dev",
        companyName: payload.companyName?.trim() || company || undefined
      });
    }
    case "feedback:list-replies": {
      const cfg = readDevSupabaseLicenseConfig();
      if (!cfg) return [];
      const company =
        String(args[0] ?? "").trim() || db.settings.get().companyName?.trim() || "";
      if (!company) return [];
      return listAppFeedbackReplies(cfg, company);
    }
    case "feedback:list-for-account": {
      const cfg = readDevSupabaseLicenseConfig();
      if (!cfg) return [];
      const email = String(args[0] ?? "").trim();
      if (!email) return [];
      return listAppFeedbackForAccount(cfg, email);
    }
    case "account:is-configured":
      return Boolean(readDevSupabaseLicenseConfig());
    case "account:get-auth-config": {
      const cfg = readDevSupabaseLicenseConfig();
      if (!cfg) return null;
      return { url: cfg.url.trim(), anonKey: cfg.anonKey.trim() };
    }
    case "app-update:get-info":
      return devAppUpdateInfo();
    case "app-update:check":
      return devAppUpdateInfo();
    case "app-update:download":
      return devAppUpdateInfo();
    case "app-update:install":
      return undefined;
    case "settings:get":
      return db.settings.get();
    case "settings:set-opening-time":
      return db.settings.setOpeningTime(String(args[0] ?? ""));
    case "settings:set-opening-cash":
      return db.settings.setOpeningCash(Number(args[0]));
    case "settings:set-closure-time":
      return db.settings.setClosureTime(String(args[0] ?? ""));
    case "settings:set-company-info":
      return db.settings.setCompanyInfo((args[0] ?? {}) as object);
    case "settings:create-backup":
      return db.createBackup((args[0] ?? []) as import("./src/db/backupModules").BackupModuleId[]);
    case "settings:list-backups":
      return db.listBackups();
    case "settings:inspect-backup":
      return db.inspectBackupByName(String(args[0] ?? ""));
    case "settings:inspect-backup-json":
      return db.inspectBackupFromJson(String(args[0] ?? ""));
    case "settings:restore-backup":
      return db.restoreBackup(
        String(args[0] ?? ""),
        (args[1] ?? []) as import("./src/db/backupModules").BackupModuleId[]
      );
    case "settings:restore-backup-json":
      return db.restoreFromJsonText(
        String(args[0] ?? ""),
        (args[1] ?? []) as import("./src/db/backupModules").BackupModuleId[]
      );
    case "closures:run": {
      const raw = args[0];
      let actualCashKurus: number | undefined;
      if (raw != null && raw !== "") {
        const n = typeof raw === "number" ? raw : Number(raw);
        if (Number.isFinite(n) && n >= 0) actualCashKurus = Math.round(n);
      }
      return new ClosureService(db).runClosureForToday(actualCashKurus);
    }
    case "shell:show-item-in-folder":
      showItemInFolderDev(String(args[0] ?? ""));
      return null;
    case "logs:list":
      return logs.list(Number(args[0] ?? 200));
    case "logs:clear":
      return logs.clear();
    case "logs:add":
      return logs.add((args[0] as "error" | "warn" | "info" | undefined) ?? "info", String(args[1] ?? ""));
    case "shell:open-external":
      return null;
    case "invoice:create":
      return createInvoiceHtml(
        db,
        (args[0] as Array<{ productId: number; qty: number; unitPriceKurus?: number }>) ?? [],
        (args[1] as PaymentType | undefined) ?? "cash",
        (args[2] as SaleKind | undefined) ?? "sale",
        undefined,
        (args[3] as InvoiceCustomerInfo | undefined) ?? undefined,
        Number(args[4]) || 0
      );
    case "invoice:preview":
      return buildInvoiceHtml(
        db,
        (args[0] as Array<{ productId: number; qty: number; unitPriceKurus?: number }>) ?? [],
        (args[1] as PaymentType | undefined) ?? "cash",
        (args[2] as SaleKind | undefined) ?? "sale",
        (args[3] as InvoiceCustomerInfo | undefined) ?? undefined,
        Number(args[4]) || 0
      ).html;
    case "export:xlsx":
      return exportSalesToXlsx(db, String(args[0] ?? ""), path.join(process.cwd(), "exports"));
    case "export:monthly-profit":
      return exportMonthlyProfitToXlsx(db, String(args[0] ?? ""), path.join(process.cwd(), "exports"));
    default:
      throw new Error(`Bilinmeyen kanal: ${channel}`);
  }
}

export function marinaDevIpcPlugin(): Plugin {
  return {
    name: "marina-dev-ipc",
    configureServer(server) {
      loadEnvLocal(process.cwd());
      const dataDir = path.join(process.cwd(), "data");
      const database = new DatabaseService(dataDir);
      const logs = new ErrorLogService(dataDir);
      database.init();
      try {
        new ClosureService(database).catchUpMissingClosuresBeforeToday();
      } catch {
        /* dev sunucu acilisinda sessiz */
      }

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith("/__marina/ipc")) {
          return next();
        }
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }
        try {
          const raw = await readBody(req);
          const { channel, args } = JSON.parse(raw || "{}") as { channel?: string; args?: unknown[] };
          if (!channel) {
            res.statusCode = 400;
            res.end("channel gerekli");
            return;
          }
          const result = await Promise.resolve(
            dispatch(database, logs, channel, Array.isArray(args) ? args : [])
          );
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(result === undefined ? null : result));
        } catch (e) {
          logs.add("error", `[dev-ipc] ${e instanceof Error ? e.stack || e.message : String(e)}`);
          res.statusCode = 500;
          res.end(e instanceof Error ? e.message : "IPC hatasi");
        }
      });
    }
  };
}
