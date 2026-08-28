import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { DatabaseService } from "../src/db/databaseService";
import { ClosureService } from "../src/features/closure/ClosureService";
import {
  getMobileApkInfo,
  resolveMobileApkPath,
  serveMobileApkFile,
  serveMobileApkInstallPage,
  serveMobileApkMissingPage
} from "./mobileApk";
import { sharedPosCart } from "./sharedPosCart";
import type {
  CashflowEntryInput,
  CategorySaleUnit,
  CustomerInput,
  SupplierInput,
  MobileLanPairPayload,
  MobileLanStatus,
  PaymentType,
  ProductInput,
  SaleKind,
  SaleLineInput,
  StockAddInput,
  TobaccoAromaInput,
  TobaccoAromaUpdate
} from "../src/types/models";

export const MOBILE_LAN_PORT = 38472;

type MobileLanConfig = {
  enabled: boolean;
  token: string;
};

type RouteContext = {
  database: DatabaseService;
  dataDir: string;
  getToken: () => string;
  appVersion: string;
};

function configPath(dataDir: string): string {
  return path.join(dataDir, "mobile-lan-config.json");
}

function readConfig(dataDir: string): MobileLanConfig {
  const file = configPath(dataDir);
  try {
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<MobileLanConfig>;
      const token = String(parsed.token ?? "").trim();
      if (token.length >= 16) {
        return { enabled: Boolean(parsed.enabled), token };
      }
    }
  } catch {
    /* yeni config */
  }
  return { enabled: false, token: crypto.randomBytes(24).toString("hex") };
}

function writeConfig(dataDir: string, cfg: MobileLanConfig): void {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(configPath(dataDir), JSON.stringify(cfg, null, 2), "utf8");
}

/** Wi‑Fi / Ethernet LAN IP tercih et; VPN / Hyper‑V / WSL adreslerini sonda birak */
export function getLanIPv4(): string {
  const nets = os.networkInterfaces();
  const candidates: { address: string; score: number }[] = [];
  for (const [name, entries] of Object.entries(nets)) {
    const nameL = String(name || "").toLowerCase();
    for (const net of entries ?? []) {
      const family = String(net.family);
      if ((family !== "IPv4" && family !== "4") || net.internal) continue;
      const a = net.address;
      let score = 0;
      if (a.startsWith("192.168.")) score += 50;
      else if (/^10\./.test(a)) score += 40;
      else if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(a)) score += 30;
      else score += 5;
      if (/wi-?fi|wlan|wireless|ethernet|eth|lan|wi fi/.test(nameL)) score += 25;
      if (/vethernet|hyper-v|vmware|virtualbox|docker|wsl|vethernet|tailscale|zerotier|vpn|hamachi/.test(nameL)) {
        score -= 40;
      }
      if (a.startsWith("169.254.")) score -= 50;
      candidates.push({ address: a, score });
    }
  }
  candidates.sort((x, y) => y.score - x.score);
  return candidates[0]?.address || "127.0.0.1";
}

/** Telefondan gelen Host basligini kullan — indirme linki yanlis IP'ye gitmesin */
export function requestLanHost(req: http.IncomingMessage): string {
  const raw = String(req.headers.host ?? "").trim();
  const hostOnly = raw.split(":")[0]?.trim() || "";
  if (
    hostOnly &&
    hostOnly !== "localhost" &&
    hostOnly !== "127.0.0.1" &&
    hostOnly !== "0.0.0.0" &&
    hostOnly !== "[::1]"
  ) {
    return hostOnly;
  }
  return getLanIPv4();
}

function maskToken(token: string): string {
  if (token.length <= 8) return "****";
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store"
  });
  res.end(payload);
}

function readJsonBody<T>(req: http.IncomingMessage, maxBytes = 2 * 1024 * 1024): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      if (chunks.reduce((n, c) => n + c.length, 0) > maxBytes) {
        reject(new Error("Gövde çok büyük"));
        req.destroy();
      }
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve({} as T);
        return;
      }
      try {
        resolve(JSON.parse(raw) as T);
      } catch {
        reject(new Error("Geçersiz JSON"));
      }
    });
    req.on("error", reject);
  });
}

function bearerToken(req: http.IncomingMessage): string {
  const header = String(req.headers.authorization ?? "").trim();
  if (header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return "";
}

function isAuthorized(req: http.IncomingMessage, token: string): boolean {
  return token.length > 0 && bearerToken(req) === token;
}

function findProductByBarcode(database: DatabaseService, barcode: string) {
  const q = barcode.trim().toLowerCase();
  if (!q) return null;
  const digits = q.replace(/\D/g, "");
  const active = database.products.list().filter((p) => p.isActive);
  return (
    active.find((p) => p.barcode.trim().toLowerCase() === q) ??
    (digits.length >= 4
      ? active.find((p) => p.barcode.replace(/\D/g, "") === digits) ?? null
      : null)
  );
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentYearMonth(): string {
  return todayIso().slice(0, 7);
}

function mimeToExt(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("png")) return ".png";
  if (m.includes("webp")) return ".webp";
  if (m.includes("gif")) return ".gif";
  return ".jpg";
}

function mediaDirOf(dataDir: string): string {
  return path.join(dataDir, "media");
}

function saveMediaFromBase64(dataDir: string, suggestedName: string, mimeType: string, dataBase64: string): string {
  const mediaDir = mediaDirOf(dataDir);
  fs.mkdirSync(mediaDir, { recursive: true });
  const ext = mimeToExt(mimeType);
  const rawBase = String(suggestedName ?? "").trim() || "image";
  const safeBase =
    rawBase
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "image";
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const targetPath = path.join(mediaDir, `${safeBase}-${stamp}${ext}`);
  fs.writeFileSync(targetPath, Buffer.from(dataBase64, "base64"));
  return targetPath;
}

function readMediaDataUrl(dataDir: string, imagePath: string): string {
  const p = String(imagePath ?? "").trim();
  if (!p) return "";
  try {
    const normalized = path.normalize(p);
    const mediaRoot = path.normalize(mediaDirOf(dataDir));
    if (!normalized.startsWith(mediaRoot)) return "";
    if (!fs.existsSync(normalized)) return "";
    const ext = path.extname(normalized).toLowerCase();
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
    const bin = fs.readFileSync(normalized);
    return `data:${mime};base64,${bin.toString("base64")}`;
  } catch {
    return "";
  }
}

function parseIdFromPath(pathname: string, prefix: string): number | null {
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length);
  const id = Number(rest.split("/")[0]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function handleRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  ctx: RouteContext,
  pathname: string,
  searchParams: URLSearchParams
): Promise<void> {
  const method = String(req.method ?? "GET").toUpperCase();
  const settings = ctx.database.settings.get();

  if (method === "GET" && pathname === "/api/health") {
    json(res, 200, {
      ok: true,
      app: "marina-pos",
      apiVersion: 2,
      version: ctx.appVersion,
      name: settings.companyName?.trim() || settings.appTitle?.trim() || "Marina Nargile POS"
    });
    return;
  }

  if (method === "GET" && pathname === "/api/mobile/apk/info") {
    json(res, 200, { ok: true, data: getMobileApkInfo(ctx.dataDir, requestLanHost(req), MOBILE_LAN_PORT) });
    return;
  }

  if (method === "GET" && pathname === "/api/mobile/install") {
    const info = getMobileApkInfo(ctx.dataDir, requestLanHost(req), MOBILE_LAN_PORT);
    if (!info.available) {
      serveMobileApkMissingPage(res);
      return;
    }
    serveMobileApkInstallPage(res, info);
    return;
  }

  if (method === "GET" && pathname === "/api/mobile/apk") {
    const file = resolveMobileApkPath(ctx.dataDir);
    if (!file) {
      serveMobileApkMissingPage(res);
      return;
    }
    serveMobileApkFile(res, file);
    return;
  }

  if (!isAuthorized(req, ctx.getToken())) {
    json(res, 401, { ok: false, error: "Yetkisiz. QR kodu tekrar okutun veya PC'de yeni kod üretin." });
    return;
  }

  if (method === "GET" && pathname === "/api/pair/info") {
    json(res, 200, {
      ok: true,
      apiVersion: 2,
      host: getLanIPv4(),
      port: MOBILE_LAN_PORT,
      name: settings.companyName?.trim() || settings.appTitle?.trim() || "Marina Nargile POS",
      version: ctx.appVersion
    });
    return;
  }

  if (method === "GET" && pathname === "/api/products") {
    json(res, 200, { ok: true, data: ctx.database.products.list().filter((p) => p.isActive) });
    return;
  }

  const productIdFromPath = parseIdFromPath(pathname, "/api/products/");
  if (productIdFromPath && !pathname.includes("/barcode/")) {
    if (method === "GET") {
      const product = ctx.database.products.getById(productIdFromPath);
      if (!product || !product.isActive) {
        json(res, 404, { ok: false, error: "Ürün bulunamadı" });
        return;
      }
      json(res, 200, { ok: true, data: product });
      return;
    }
    if (method === "PUT") {
      const body = await readJsonBody<Partial<ProductInput>>(req);
      ctx.database.products.update(productIdFromPath, body);
      json(res, 200, { ok: true });
      return;
    }
    if (method === "DELETE") {
      ctx.database.products.softDelete(productIdFromPath);
      json(res, 200, { ok: true });
      return;
    }
  }

  if (method === "GET" && pathname.startsWith("/api/products/barcode/")) {
    const encoded = pathname.slice("/api/products/barcode/".length);
    const barcode = decodeURIComponent(encoded);
    const product = findProductByBarcode(ctx.database, barcode);
    if (!product) {
      json(res, 404, { ok: false, error: "Ürün bulunamadı" });
      return;
    }
    json(res, 200, { ok: true, data: product });
    return;
  }

  if (method === "GET" && pathname === "/api/categories") {
    json(res, 200, { ok: true, data: ctx.database.products.listCategories() });
    return;
  }

  if (method === "POST" && pathname === "/api/categories") {
    const body = await readJsonBody<{ name?: string; saleUnit?: CategorySaleUnit }>(req);
    const name = String(body.name ?? "").trim();
    if (!name) {
      json(res, 400, { ok: false, error: "Kategori adı gerekli" });
      return;
    }
    const saleUnit: CategorySaleUnit = body.saleUnit === "gram" ? "gram" : "piece";
    const category = ctx.database.products.createCategory(name, saleUnit);
    json(res, 201, { ok: true, data: category });
    return;
  }

  const categoryId = parseIdFromPath(pathname, "/api/categories/");
  if (categoryId && method === "PUT") {
    const body = await readJsonBody<{ name?: string; saleUnit?: CategorySaleUnit }>(req);
    const updated = ctx.database.products.updateCategory(categoryId, body);
    if (!updated) {
      json(res, 404, { ok: false, error: "Kategori bulunamadı" });
      return;
    }
    json(res, 200, { ok: true, data: updated });
    return;
  }
  if (categoryId && method === "DELETE") {
    try {
      ctx.database.products.deleteCategory(categoryId);
      json(res, 200, { ok: true });
    } catch (e) {
      json(res, 400, { ok: false, error: e instanceof Error ? e.message : "Kategori silinemedi" });
    }
    return;
  }

  if (method === "GET" && pathname === "/api/suppliers") {
    json(res, 200, { ok: true, data: ctx.database.products.listSuppliers() });
    return;
  }

  if (method === "GET" && pathname === "/api/customers") {
    json(res, 200, { ok: true, data: ctx.database.customers.list() });
    return;
  }

  if (method === "POST" && pathname === "/api/customers") {
    const body = await readJsonBody<CustomerInput>(req);
    if (!String(body.name ?? "").trim()) {
      json(res, 400, { ok: false, error: "Müşteri adı gerekli" });
      return;
    }
    const customer = ctx.database.customers.create(body);
    json(res, 201, { ok: true, data: customer });
    return;
  }

  const customerSub = pathname.match(/^\/api\/customers\/(\d+)\/(.+)$/);
  if (customerSub) {
    const customerId = Number(customerSub[1]);
    const action = customerSub[2];
    if (!Number.isFinite(customerId) || customerId <= 0) {
      json(res, 400, { ok: false, error: "Geçersiz müşteri ID" });
      return;
    }
    if (method === "GET" && action === "stats") {
      const stats = ctx.database.sales.getCustomerStats(customerId);
      if (!stats) {
        json(res, 404, { ok: false, error: "Müşteri bulunamadı" });
        return;
      }
      json(res, 200, { ok: true, data: stats });
      return;
    }
    if (method === "GET" && action === "sales") {
      const limit = Number(searchParams.get("limit") ?? 24);
      json(res, 200, { ok: true, data: ctx.database.sales.getSalesForCustomer(customerId, limit) });
      return;
    }
    if (method === "GET" && action === "purchases") {
      json(res, 200, { ok: true, data: ctx.database.customers.getPurchaseSummary(customerId) });
      return;
    }
    if (method === "GET" && action === "product-prices") {
      json(res, 200, { ok: true, data: ctx.database.customers.listProductPrices(customerId) });
      return;
    }
    if (method === "PUT" && action === "product-prices") {
      const body = await readJsonBody<{ productId?: number; priceKurus?: number }>(req);
      const productId = Number(body.productId);
      const priceKurus = Number(body.priceKurus);
      if (!Number.isFinite(productId) || productId <= 0) {
        json(res, 400, { ok: false, error: "Ürün ID gerekli" });
        return;
      }
      try {
        ctx.database.customers.setProductPrice(customerId, productId, priceKurus);
      } catch (e) {
        json(res, 400, { ok: false, error: e instanceof Error ? e.message : "Fiyat kaydedilemedi" });
        return;
      }
      json(res, 200, { ok: true });
      return;
    }
    if (method === "POST" && action === "debt-payment") {
      const body = await readJsonBody<{ paymentType?: PaymentType; amountKurus?: number; paymentNote?: string }>(req);
      const paymentType: PaymentType = body.paymentType === "card" ? "card" : "cash";
      try {
        ctx.database.sales.recordDebtPayment(
          customerId,
          paymentType,
          body.amountKurus != null && Number.isFinite(Number(body.amountKurus)) ? Number(body.amountKurus) : undefined,
          body.paymentNote != null ? String(body.paymentNote) : undefined
        );
      } catch (e) {
        json(res, 400, { ok: false, error: e instanceof Error ? e.message : "Tahsilat kaydedilemedi" });
        return;
      }
      json(res, 200, { ok: true, data: ctx.database.customers.getById(customerId) });
      return;
    }
  }

  if (method === "POST" && pathname === "/api/suppliers") {
    const body = await readJsonBody<SupplierInput>(req);
    if (!String(body.name ?? "").trim()) {
      json(res, 400, { ok: false, error: "Tedarikçi adı gerekli" });
      return;
    }
    try {
      const supplier = ctx.database.products.createSupplier(body);
      json(res, 201, { ok: true, data: supplier });
    } catch (e) {
      json(res, 400, { ok: false, error: e instanceof Error ? e.message : "Tedarikçi kaydedilemedi" });
    }
    return;
  }

  const supplierSub = pathname.match(/^\/api\/suppliers\/(\d+)\/(.+)$/);
  if (supplierSub) {
    const supplierId = Number(supplierSub[1]);
    const action = supplierSub[2];
    if (!Number.isFinite(supplierId) || supplierId <= 0) {
      json(res, 400, { ok: false, error: "Geçersiz tedarikçi ID" });
      return;
    }
    if (method === "GET" && action === "overview") {
      const overview = ctx.database.products.getSupplierOverview(supplierId);
      if (!overview) {
        json(res, 404, { ok: false, error: "Tedarikçi bulunamadı" });
        return;
      }
      json(res, 200, { ok: true, data: overview });
      return;
    }
    if (method === "POST" && action === "debt-payment") {
      const body = await readJsonBody<{ paymentType?: PaymentType; amountKurus?: number; paymentNote?: string }>(req);
      const paymentType: PaymentType = body.paymentType === "card" ? "card" : "cash";
      try {
        ctx.database.products.recordSupplierDebtPayment(
          supplierId,
          paymentType,
          body.amountKurus != null && Number.isFinite(Number(body.amountKurus)) ? Number(body.amountKurus) : undefined,
          body.paymentNote != null ? String(body.paymentNote) : undefined
        );
      } catch (e) {
        json(res, 400, { ok: false, error: e instanceof Error ? e.message : "Ödeme kaydedilemedi" });
        return;
      }
      const updated = ctx.database.products.listSuppliers().find((s) => s.id === supplierId) ?? null;
      json(res, 200, { ok: true, data: updated });
      return;
    }
  }

  const supplierIdFromPath = parseIdFromPath(pathname, "/api/suppliers/");
  if (supplierIdFromPath && method === "PUT") {
    const body = await readJsonBody<Partial<SupplierInput>>(req);
    try {
      const updated = ctx.database.products.updateSupplier(supplierIdFromPath, body);
      if (!updated) {
        json(res, 404, { ok: false, error: "Tedarikçi bulunamadı" });
        return;
      }
      json(res, 200, { ok: true, data: updated });
    } catch (e) {
      json(res, 400, { ok: false, error: e instanceof Error ? e.message : "Tedarikçi güncellenemedi" });
    }
    return;
  }

  const customerId = parseIdFromPath(pathname, "/api/customers/");
  if (customerId && method === "PUT") {
    const body = await readJsonBody<Partial<CustomerInput>>(req);
    const updated = ctx.database.customers.update(customerId, body);
    if (!updated) {
      json(res, 404, { ok: false, error: "Müşteri bulunamadı" });
      return;
    }
    json(res, 200, { ok: true, data: updated });
    return;
  }

  if (method === "GET" && pathname === "/api/settings") {
    json(res, 200, { ok: true, data: settings });
    return;
  }

  if (method === "GET" && pathname === "/api/stock/low") {
    json(res, 200, { ok: true, data: ctx.database.products.lowStock() });
    return;
  }

  if (method === "GET" && pathname === "/api/sales/today") {
    const date = String(searchParams.get("date") ?? todayIso()).slice(0, 10);
    json(res, 200, { ok: true, data: ctx.database.sales.getByDate(date) });
    return;
  }

  if (method === "GET" && pathname === "/api/sales/history") {
    const limit = Number(searchParams.get("limit") ?? 50);
    json(res, 200, { ok: true, data: ctx.database.sales.listSalesHistory(limit) });
    return;
  }

  if (method === "GET" && pathname === "/api/reports/dashboard") {
    json(res, 200, { ok: true, data: ctx.database.sales.getDashboardReport() });
    return;
  }

  if (method === "GET" && pathname === "/api/reports/day-profit") {
    const date = String(searchParams.get("date") ?? todayIso()).slice(0, 10);
    json(res, 200, { ok: true, data: ctx.database.sales.getProfitDetailForDate(date) });
    return;
  }

  if (method === "GET" && pathname === "/api/reports/monthly-days") {
    const yearMonth = String(searchParams.get("month") ?? currentYearMonth()).slice(0, 7);
    json(res, 200, { ok: true, data: ctx.database.sales.getMonthlyDayTotals(yearMonth) });
    return;
  }

  if (method === "GET" && pathname === "/api/tobacco") {
    json(res, 200, { ok: true, data: ctx.database.tobaccoAromas.list() });
    return;
  }

  if (method === "POST" && pathname === "/api/tobacco") {
    const body = await readJsonBody<TobaccoAromaInput>(req);
    if (!String(body.name ?? "").trim()) {
      json(res, 400, { ok: false, error: "Aroma adı gerekli" });
      return;
    }
    const aroma = ctx.database.tobaccoAromas.create(body);
    json(res, 201, { ok: true, data: aroma });
    return;
  }

  const tobaccoId = parseIdFromPath(pathname, "/api/tobacco/");
  if (tobaccoId) {
    if (method === "PUT") {
      const body = await readJsonBody<TobaccoAromaUpdate>(req);
      const aroma = ctx.database.tobaccoAromas.update(tobaccoId, body);
      json(res, 200, { ok: true, data: aroma });
      return;
    }
    if (method === "DELETE") {
      ctx.database.tobaccoAromas.delete(tobaccoId);
      json(res, 200, { ok: true });
      return;
    }
  }

  if (method === "GET" && pathname === "/api/cashflow") {
    const yearMonth = String(searchParams.get("month") ?? currentYearMonth()).slice(0, 7);
    json(res, 200, {
      ok: true,
      data: {
        entries: ctx.database.cashflow.listForMonth(yearMonth),
        summary: ctx.database.cashflow.getMonthlySummary(yearMonth)
      }
    });
    return;
  }

  if (method === "POST" && pathname === "/api/cashflow") {
    const body = await readJsonBody<CashflowEntryInput>(req);
    const entry = ctx.database.cashflow.create(body);
    json(res, 201, { ok: true, data: entry });
    return;
  }

  const cashflowId = parseIdFromPath(pathname, "/api/cashflow/");
  if (cashflowId && method === "DELETE") {
    ctx.database.cashflow.delete(cashflowId);
    json(res, 200, { ok: true });
    return;
  }

  if (method === "POST" && pathname === "/api/closure/run") {
    const body = await readJsonBody<{ actualCashKurus?: number | null }>(req);
    const actual =
      body.actualCashKurus != null && Number.isFinite(Number(body.actualCashKurus))
        ? Number(body.actualCashKurus)
        : undefined;
    const result = new ClosureService(ctx.database).runClosureForToday(actual);
    json(res, 200, { ok: true, data: result });
    return;
  }

  if (method === "GET" && pathname === "/api/media/data-url") {
    const imagePath = decodeURIComponent(String(searchParams.get("path") ?? ""));
    const dataUrl = readMediaDataUrl(ctx.dataDir, imagePath);
    if (!dataUrl) {
      json(res, 404, { ok: false, error: "Resim bulunamadı" });
      return;
    }
    json(res, 200, { ok: true, data: { dataUrl } });
    return;
  }

  if (method === "POST" && pathname === "/api/media/upload") {
    const body = await readJsonBody<{
      suggestedName?: string;
      mimeType?: string;
      dataBase64?: string;
    }>(req, 8 * 1024 * 1024);
    const dataBase64 = String(body.dataBase64 ?? "").trim();
    if (!dataBase64) {
      json(res, 400, { ok: false, error: "Resim verisi gerekli" });
      return;
    }
    const imagePath = saveMediaFromBase64(
      ctx.dataDir,
      String(body.suggestedName ?? "urun"),
      String(body.mimeType ?? "image/jpeg"),
      dataBase64
    );
    json(res, 201, { ok: true, data: { imagePath } });
    return;
  }

  if (method === "POST" && pathname === "/api/products") {
    const body = await readJsonBody<Partial<ProductInput>>(req);
    const payload = body as ProductInput;
    if (!String(payload.name ?? "").trim()) {
      json(res, 400, { ok: false, error: "Ürün adı gerekli" });
      return;
    }
    ctx.database.products.create(payload);
    json(res, 201, { ok: true });
    return;
  }

  if (method === "POST" && pathname === "/api/stock/add") {
    const body = await readJsonBody<{
      productId?: number;
      quantity?: number;
      input?: StockAddInput;
    }>(req);
    const productId = Number(body.productId);
    const quantity = Number(body.quantity);
    if (!Number.isFinite(productId) || productId <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
      json(res, 400, { ok: false, error: "Geçersiz stok girişi" });
      return;
    }
    ctx.database.products.addStock(productId, quantity, body.input ?? { supplierId: 0, costMode: "product" });
    json(res, 201, { ok: true });
    return;
  }

  if (method === "POST" && pathname === "/api/stock/adjust") {
    const body = await readJsonBody<{ productId?: number; countedQty?: number; note?: string }>(req);
    const productId = Number(body.productId);
    const countedQty = Number(body.countedQty);
    if (!Number.isFinite(productId) || productId <= 0 || !Number.isFinite(countedQty) || countedQty < 0) {
      json(res, 400, { ok: false, error: "Geçersiz stok sayımı" });
      return;
    }
    ctx.database.products.adjustStock(productId, countedQty, String(body.note ?? ""));
    json(res, 201, { ok: true });
    return;
  }

  if (method === "GET" && pathname === "/api/pos/cart") {
    const snap = sharedPosCart.getSnapshot();
    const products = ctx.database.products.list();
    const byId = new Map(products.map((p) => [p.id, p]));
    const lines = snap.lines.map((line) => {
      const product = byId.get(line.productId) ?? null;
      return {
        ...line,
        product: product
          ? {
              id: product.id,
              name: product.name,
              barcode: product.barcode,
              code: product.code,
              priceKurus: product.priceKurus,
              stockQty: product.stockQty,
              categoryId: product.categoryId,
              imagePath: product.imagePath,
              discountPercent: product.discountPercent
            }
          : null
      };
    });
    json(res, 200, {
      ok: true,
      data: { revision: snap.revision, activeCartId: snap.activeCartId, lines }
    });
    return;
  }

  if (method === "POST" && pathname === "/api/pos/cart/scan") {
    const body = await readJsonBody<{ barcode?: string; priceSource?: string }>(req);
    const barcode = String(body.barcode ?? "").trim();
    if (!barcode) {
      json(res, 400, { ok: false, error: "Barkod gerekli" });
      return;
    }
    const product = findProductByBarcode(ctx.database, barcode);
    if (!product) {
      json(res, 404, { ok: false, error: "Barkod bulunamadi" });
      return;
    }
    const priceSource =
      body.priceSource === "wholesale" || body.priceSource === "alternate" ? body.priceSource : "retail";
    const op = sharedPosCart.enqueueBarcode(barcode, priceSource);
    json(res, 201, { ok: true, data: { opId: op.id, productId: product.id, productName: product.name } });
    return;
  }

  if (method === "POST" && pathname === "/api/pos/cart/add") {
    const body = await readJsonBody<{ productId?: number; qty?: number; priceSource?: string }>(req);
    const productId = Number(body.productId);
    if (!Number.isFinite(productId) || productId <= 0) {
      json(res, 400, { ok: false, error: "Gecersiz urun" });
      return;
    }
    const product = ctx.database.products.getById(productId);
    if (!product || !product.isActive) {
      json(res, 404, { ok: false, error: "Urun bulunamadi" });
      return;
    }
    const priceSource =
      body.priceSource === "wholesale" || body.priceSource === "alternate" ? body.priceSource : "retail";
    const qty = Math.max(1, Math.floor(Number(body.qty) || 1));
    const op = sharedPosCart.enqueueProduct(productId, qty, priceSource);
    json(res, 201, { ok: true, data: { opId: op.id, productId: product.id, productName: product.name } });
    return;
  }

  if (method === "POST" && pathname === "/api/pos/cart/clear") {
    sharedPosCart.clear();
    json(res, 200, { ok: true });
    return;
  }

  if (method === "POST" && pathname === "/api/sales") {
    const body = await readJsonBody<{
      items?: SaleLineInput[];
      paymentType?: PaymentType;
      paidAmountKurus?: number;
      kind?: SaleKind;
      cartName?: string;
      customerId?: number | null;
      extraFeeKurus?: number;
      cashAmountKurus?: number;
      cardAmountKurus?: number;
    }>(req);
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      json(res, 400, { ok: false, error: "Sepet boş" });
      return;
    }
    const paymentType: PaymentType =
      body.paymentType === "card" ? "card" : body.paymentType === "mixed" ? "mixed" : "cash";
    const paidAmount = Number(body.paidAmountKurus ?? 0);
    const kind: SaleKind = body.kind === "return" ? "return" : body.kind === "debt_payment" ? "debt_payment" : "sale";
    const paymentSplit =
      paymentType === "mixed"
        ? {
            cashAmountKurus: Math.max(0, Math.round(Number(body.cashAmountKurus) || 0)),
            cardAmountKurus: Math.max(0, Math.round(Number(body.cardAmountKurus) || 0))
          }
        : null;
    ctx.database.sales.create(
      items.map((line) => ({
        productId: Number(line.productId),
        qty: Number(line.qty),
        unitPriceKurus: line.unitPriceKurus,
        unitCostKurus: line.unitCostKurus,
        lineTotalKurus: line.lineTotalKurus
      })),
      paymentType,
      paidAmount,
      kind,
      String(body.cartName ?? "Mobil"),
      body.customerId ?? null,
      Number(body.extraFeeKurus) || 0,
      paymentSplit
    );
    sharedPosCart.clear();
    json(res, 201, { ok: true });
    return;
  }

  json(res, 404, { ok: false, error: "Endpoint bulunamadı" });
}

export class MobileLanServer {
  private server: http.Server | null = null;
  private config: MobileLanConfig;
  private readonly dataDir: string;
  private readonly database: DatabaseService;
  private readonly appVersion: string;

  constructor(database: DatabaseService, dataDir: string, appVersion: string) {
    this.database = database;
    this.dataDir = dataDir;
    this.appVersion = appVersion;
    this.config = readConfig(dataDir);
  }

  getStatus(): MobileLanStatus {
    const host = getLanIPv4();
    const running = Boolean(this.server) && this.config.enabled;
    const settings = this.database.settings.get();
    const apk = getMobileApkInfo(this.dataDir, host, MOBILE_LAN_PORT);
    return {
      enabled: this.config.enabled,
      running,
      host,
      port: MOBILE_LAN_PORT,
      tokenMasked: maskToken(this.config.token),
      companyName: settings.companyName?.trim() || settings.appTitle?.trim() || "Marina Nargile POS",
      appVersion: this.appVersion,
      apkAvailable: apk.available,
      apkFilename: apk.filename,
      apkSizeBytes: apk.sizeBytes,
      apkDownloadUrl: apk.downloadUrl,
      apkInstallPageUrl: apk.installPageUrl
    };
  }

  getApkInfo() {
    return getMobileApkInfo(this.dataDir, getLanIPv4(), MOBILE_LAN_PORT);
  }

  getPairPayload(): MobileLanPairPayload {
    const settings = this.database.settings.get();
    return {
      v: 1,
      app: "marina-pos",
      host: getLanIPv4(),
      port: MOBILE_LAN_PORT,
      token: this.config.token,
      name: settings.companyName?.trim() || settings.appTitle?.trim() || "Marina Nargile POS"
    };
  }

  setEnabled(enabled: boolean): MobileLanStatus {
    this.config.enabled = enabled;
    writeConfig(this.dataDir, this.config);
    if (enabled) {
      this.start();
    } else {
      this.stop();
    }
    return this.getStatus();
  }

  regenerateToken(): MobileLanStatus {
    this.config.token = crypto.randomBytes(24).toString("hex");
    writeConfig(this.dataDir, this.config);
    return this.getStatus();
  }

  start(): void {
    if (this.server) return;
    if (!this.config.enabled) return;

    const ctx: RouteContext = {
      database: this.database,
      dataDir: this.dataDir,
      getToken: () => this.config.token,
      appVersion: this.appVersion
    };

    this.server = http.createServer(async (req, res) => {
      try {
        const url = new URL(String(req.url ?? "/"), `http://${req.headers.host ?? "localhost"}`);
        await handleRoute(req, res, ctx, url.pathname, url.searchParams);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (!res.headersSent) {
          json(res, 500, { ok: false, error: message });
        }
      }
    });

    this.server.listen(MOBILE_LAN_PORT, "0.0.0.0", () => {
      console.log(`[mobile-lan] Dinleniyor: http://${getLanIPv4()}:${MOBILE_LAN_PORT}`);
    });

    this.server.on("error", (e) => {
      console.error("[mobile-lan]", e);
    });
  }

  stop(): void {
    if (!this.server) return;
    this.server.close();
    this.server = null;
  }

  init(): void {
    writeConfig(this.dataDir, this.config);
    if (this.config.enabled) {
      this.start();
    }
  }

  shutdown(): void {
    this.stop();
  }
}
