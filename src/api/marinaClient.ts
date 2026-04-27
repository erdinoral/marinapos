import type {
  Category,
  ClosureRunResult,
  DayProfitDetail,
  PaymentType,
  Product,
  ProductInput,
  SaleKind,
  SaleRecord,
  StockAgingRow,
  StockEntryLogRow,
  Settings
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

function createBrowserDevApi(): MarinaApi {
  return {
    listProducts: () => devInvoke<Product[]>("products:list"),
    listCategories: () => devInvoke<Category[]>("categories:list"),
    createCategory: (name) => devInvoke<Category>("categories:create", [name]),
    createProduct: (payload) => devInvoke<void>("products:create", [payload]),
    addStock: (productId, quantity) => devInvoke<void>("products:add-stock", [productId, quantity]),
    adjustStock: (productId, countedQty, note = "") => devInvoke<void>("products:adjust-stock", [productId, countedQty, note]),
    lowStock: () => devInvoke<Product[]>("products:low-stock"),
    selectImage: async () => window.prompt("Tarayici modu: resim dosyasinin tam yolunu girin", "") ?? "",
    createSale: (items, paymentType, paidAmount, kind: SaleKind = "sale") =>
      devInvoke<void>("sales:create", [items, paymentType, paidAmount, kind]),
    getDailySales: (date) => devInvoke<SaleRecord[]>("sales:daily", [date]),
    getDayProfitDetail: (date) => devInvoke<DayProfitDetail>("profit:day-detail", [date]),
    getStockAging: () => devInvoke<StockAgingRow[]>("stock:aging"),
    getStockEntryLog: () => devInvoke<StockEntryLogRow[]>("products:stock-entry-log"),
    getSettings: () => devInvoke<Settings>("settings:get"),
    setOpeningTime: (openingTime) => devInvoke<void>("settings:set-opening-time", [openingTime]),
    setClosureTime: (closureTime) => devInvoke<void>("settings:set-closure-time", [closureTime]),
    setOpeningCash: (amountKurus) => devInvoke<void>("settings:set-opening-cash", [amountKurus]),
    runClosure: (actualCashKurus) => devInvoke<ClosureRunResult>("closures:run", [actualCashKurus]),
    showItemInFolder: (fullPath) => devInvoke<void>("shell:show-item-in-folder", [fullPath]),
    exportXlsx: (date) => devInvoke<string>("export:xlsx", [date]),
    exportMonthlyProfitXlsx: (yearMonth) => devInvoke<string>("export:monthly-profit", [yearMonth])
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
  if (import.meta.env.DEV) {
    cached = createBrowserDevApi();
    return cached;
  }
  throw new Error("Marina API yok. Uygulamayi Electron ile acin: npm run dev veya npm start.");
}
