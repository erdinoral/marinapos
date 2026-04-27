import type {
  Category,
  ClosureRunResult,
  DayProfitDetail,
  DayProfitLine,
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

type BrowserSaleItem = {
  id: number;
  saleId: number;
  productId: number;
  qty: number;
  unitPriceKurus: number;
  lineTotalKurus: number;
  unitCostKurus: number;
  lineCostKurus: number;
};

type BrowserStore = {
  categories: Category[];
  products: Product[];
  sales: SaleRecord[];
  saleItems: BrowserSaleItem[];
  stockMovements: Array<{ id: number; productId: number; type: "in" | "out" | "adjust"; qty: number; note: string; createdAt: string }>;
  settings: Settings;
  closures: Array<{ id: number; closureDate: string; reportPath: string }>;
  sequences: { productId: number; categoryId: number; saleId: number; saleItemId: number; stockMovementId: number; closureId: number };
};

const BROWSER_STORE_KEY = "marina-pos-browser-store-v1";

function initialBrowserStore(): BrowserStore {
  const categories: Category[] = [
    { id: 1, name: "Tutun" },
    { id: 2, name: "Koz" },
    { id: 3, name: "Aksesuar" }
  ];
  const products: Product[] = [
    {
      id: 1,
      name: "Adalya Love66 250gr",
      description: "Karpuz kavun nane",
      barcode: "8691000000011",
      code: "TUT-001",
      priceKurus: 55000,
      costPriceKurus: 38500,
      stockQty: 18,
      imagePath: "",
      categoryId: 1,
      isActive: 1
    },
    {
      id: 2,
      name: "C26 Hindistan Cevizi Koz 1kg",
      description: "Premium dogal koz",
      barcode: "8691000000015",
      code: "KOZ-001",
      priceKurus: 28000,
      costPriceKurus: 19600,
      stockQty: 25,
      imagePath: "",
      categoryId: 2,
      isActive: 1
    },
    {
      id: 3,
      name: "Nargile Lulesi Phunnel",
      description: "Seramik phunnel lule",
      barcode: "8691000000017",
      code: "AKS-001",
      priceKurus: 19000,
      costPriceKurus: 13300,
      stockQty: 15,
      imagePath: "",
      categoryId: 3,
      isActive: 1
    }
  ];
  return {
    categories,
    products,
    sales: [],
    saleItems: [],
    stockMovements: products.map((p, idx) => ({
      id: idx + 1,
      productId: p.id,
      type: "in" as const,
      qty: p.stockQty,
      note: "Demo urun stok girisi",
      createdAt: new Date().toISOString()
    })),
    settings: { openingTime: "09:00", closureTime: "23:00", lowStockThreshold: 10, openingCashKurus: 0, openingCashDate: "" },
    closures: [],
    sequences: { productId: 3, categoryId: 3, saleId: 0, saleItemId: 0, stockMovementId: 3, closureId: 0 }
  };
}

function loadBrowserStore(): BrowserStore {
  const raw = window.localStorage.getItem(BROWSER_STORE_KEY);
  if (!raw) return initialBrowserStore();
  try {
    const parsed = JSON.parse(raw) as BrowserStore;
    if (!parsed.settings.openingTime) parsed.settings.openingTime = "09:00";
    return parsed;
  } catch {
    return initialBrowserStore();
  }
}

function saveBrowserStore(state: BrowserStore) {
  window.localStorage.setItem(BROWSER_STORE_KEY, JSON.stringify(state));
}

function createBrowserDevApi(): MarinaApi {
  const getState = () => loadBrowserStore();
  const setState = (state: BrowserStore) => saveBrowserStore(state);
  const todayIso = () => new Date().toISOString();
  const todayDate = () => new Date().toISOString().slice(0, 10);

  return {
    listProducts: async () => getState().products.filter((p) => p.isActive === 1).sort((a, b) => a.name.localeCompare(b.name)),
    listCategories: async () => getState().categories.slice().sort((a, b) => a.name.localeCompare(b.name)),
    createCategory: async (name) => {
      const normalized = name.trim();
      if (!normalized) throw new Error("Kategori adi bos olamaz.");
      const state = getState();
      const existing = state.categories.find((x) => x.name.toLowerCase() === normalized.toLowerCase());
      if (existing) return existing;
      state.sequences.categoryId += 1;
      const created = { id: state.sequences.categoryId, name: normalized };
      state.categories.push(created);
      setState(state);
      return created;
    },
    createProduct: async (payload) => {
      const state = getState();
      state.sequences.productId += 1;
      state.products.push({ id: state.sequences.productId, ...payload, isActive: 1 });
      state.sequences.stockMovementId += 1;
      state.stockMovements.push({
        id: state.sequences.stockMovementId,
        productId: state.sequences.productId,
        type: "in",
        qty: payload.stockQty,
        note: "Ilk stok girisi",
        createdAt: todayIso()
      });
      setState(state);
    },
    addStock: async (productId, quantity) => {
      const state = getState();
      const product = state.products.find((p) => p.id === productId);
      if (!product) return;
      product.stockQty += quantity;
      state.sequences.stockMovementId += 1;
      state.stockMovements.push({
        id: state.sequences.stockMovementId,
        productId,
        type: "in",
        qty: quantity,
        note: "Stok ekleme",
        createdAt: todayIso()
      });
      setState(state);
    },
    adjustStock: async (productId, countedQty, note = "") => {
      const state = getState();
      const product = state.products.find((p) => p.id === productId);
      if (!product) return;
      const diff = countedQty - product.stockQty;
      if (diff === 0) return;
      product.stockQty = countedQty;
      state.sequences.stockMovementId += 1;
      state.stockMovements.push({
        id: state.sequences.stockMovementId,
        productId,
        type: "adjust",
        qty: Math.abs(diff),
        note: note ? `Sayim duzeltme: ${note}` : "Sayim duzeltme",
        createdAt: todayIso()
      });
      setState(state);
    },
    lowStock: async () => {
      const state = getState();
      return state.products
        .filter((x) => x.isActive === 1 && x.stockQty < state.settings.lowStockThreshold)
        .sort((a, b) => a.stockQty - b.stockQty);
    },
    selectImage: async () => window.prompt("Tarayici modu: resim dosyasinin tam yolunu girin", "") ?? "",
    createSale: async (items, paymentType, paidAmount, kind: SaleKind = "sale") => {
      const state = getState();
      const sign = kind === "return" ? -1 : 1;
      let subtotalKurus = 0;
      const normalized = items.map((item) => {
        const product = state.products.find((p) => p.id === item.productId && p.isActive === 1);
        if (!product) throw new Error("Urun bulunamadi.");
        if (kind === "sale" && product.stockQty < item.qty) throw new Error("Yetersiz stok.");
        const lineTotalKurus = item.qty * product.priceKurus * sign;
        const lineCostKurus = item.qty * product.costPriceKurus * sign;
        subtotalKurus += lineTotalKurus;
        return { ...item, unitPriceKurus: product.priceKurus, unitCostKurus: product.costPriceKurus, lineTotalKurus, lineCostKurus };
      });
      const paidAmountKurus = kind === "return" ? subtotalKurus : paymentType === "card" ? subtotalKurus : paidAmount;
      state.sequences.saleId += 1;
      const saleId = state.sequences.saleId;
      state.sales.push({
        id: saleId,
        createdAt: todayIso(),
        kind,
        paymentType,
        subtotalKurus,
        paidAmountKurus,
        changeAmountKurus: paidAmountKurus - subtotalKurus
      });
      for (const item of normalized) {
        state.sequences.saleItemId += 1;
        state.saleItems.push({
          id: state.sequences.saleItemId,
          saleId,
          productId: item.productId,
          qty: item.qty,
          unitPriceKurus: item.unitPriceKurus,
          lineTotalKurus: item.lineTotalKurus,
          unitCostKurus: item.unitCostKurus,
          lineCostKurus: item.lineCostKurus
        });
        const product = state.products.find((p) => p.id === item.productId)!;
        product.stockQty += kind === "return" ? item.qty : -item.qty;
        state.sequences.stockMovementId += 1;
        state.stockMovements.push({
          id: state.sequences.stockMovementId,
          productId: item.productId,
          type: kind === "return" ? "in" : "out",
          qty: item.qty,
          note: kind === "return" ? "Iade" : "Satis",
          createdAt: todayIso()
        });
      }
      setState(state);
    },
    getDailySales: async (date) => getState().sales.filter((s) => s.createdAt.slice(0, 10) === date).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    getDayProfitDetail: async (date) => {
      const state = getState();
      const sales = state.sales.filter((s) => s.createdAt.slice(0, 10) === date);
      const saleIds = new Set(sales.map((s) => s.id));
      const items = state.saleItems.filter((i) => saleIds.has(i.saleId));
      const lines: DayProfitLine[] = items.map((i) => {
        const sale = state.sales.find((s) => s.id === i.saleId)!;
        const product = state.products.find((p) => p.id === i.productId);
        return {
          saleItemId: i.id,
          saleId: i.saleId,
          saleCreatedAt: sale.createdAt,
          saleKind: sale.kind,
          productId: i.productId,
          productName: product?.name ?? "(silinmis urun)",
          productCode: product?.code ?? "",
          qty: i.qty,
          unitCostKurus: i.unitCostKurus,
          unitPriceKurus: i.unitPriceKurus,
          lineCostKurus: i.lineCostKurus,
          lineTotalKurus: i.lineTotalKurus,
          lineProfitKurus: i.lineTotalKurus - i.lineCostKurus
        };
      });
      const revenueKurus = lines.reduce((s, l) => s + l.lineTotalKurus, 0);
      const costTotalKurus = lines.reduce((s, l) => s + l.lineCostKurus, 0);
      return { revenueKurus, costTotalKurus, profitKurus: revenueKurus - costTotalKurus, lines };
    },
    getStockAging: async () => {
      const state = getState();
      return state.products
        .filter((p) => p.isActive === 1)
        .map((p) => ({
          productId: p.id,
          productName: p.name,
          productCode: p.code,
          stockQty: p.stockQty,
          soldQty: state.stockMovements.filter((m) => m.productId === p.id && m.type === "out").reduce((s, m) => s + m.qty, 0),
          avgDaysToSell: null,
          currentStockAgeDays: null
        }));
    },
    getStockEntryLog: async () => {
      const state = getState();
      return state.stockMovements
        .filter((m) => m.type === "in")
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 250)
        .map((m) => {
          const p = state.products.find((x) => x.id === m.productId);
          return {
            movementId: m.id,
            createdAt: m.createdAt,
            productId: m.productId,
            productName: p?.name ?? "(silinmis urun)",
            productCode: p?.code ?? "",
            qty: m.qty,
            note: m.note
          };
        });
    },
    getSettings: async () => getState().settings,
    setOpeningTime: async (openingTime) => {
      const state = getState();
      state.settings.openingTime = openingTime;
      setState(state);
    },
    setClosureTime: async (closureTime) => {
      const state = getState();
      state.settings.closureTime = closureTime;
      setState(state);
    },
    setOpeningCash: async (amountKurus) => {
      const state = getState();
      state.settings.openingCashKurus = Math.max(0, Math.round(amountKurus));
      state.settings.openingCashDate = todayDate();
      setState(state);
    },
    runClosure: async (actualCashKurus) => {
      const state = getState();
      const date = todayDate();
      const dailySales = state.sales.filter((s) => s.createdAt.slice(0, 10) === date);
      const cashTotalKurus = dailySales.filter((s) => s.paymentType === "cash").reduce((s, x) => s + x.subtotalKurus, 0);
      const cardTotalKurus = dailySales.filter((s) => s.paymentType === "card").reduce((s, x) => s + x.subtotalKurus, 0);
      const grossRevenueKurus = dailySales.reduce((s, x) => s + x.subtotalKurus, 0);
      const detail = await (createBrowserDevApi().getDayProfitDetail(date));
      const openingCashKurus = state.settings.openingCashDate === date ? state.settings.openingCashKurus : 0;
      const expectedCashKurus = openingCashKurus + cashTotalKurus;
      const normalizedActualCashKurus =
        actualCashKurus != null && Number.isFinite(actualCashKurus) && actualCashKurus >= 0 ? Math.round(actualCashKurus) : null;
      const cashDiffKurus = normalizedActualCashKurus == null ? null : normalizedActualCashKurus - expectedCashKurus;
      state.sequences.closureId += 1;
      state.closures.push({ id: state.sequences.closureId, closureDate: date, reportPath: `browser://kapanis-${date}.txt` });
      setState(state);
      return {
        date,
        reportPath: `browser://kapanis-${date}.txt`,
        totalSalesCount: dailySales.length,
        cashTotalKurus,
        cardTotalKurus,
        grossRevenueKurus,
        costTotalKurus: detail.costTotalKurus,
        profitKurus: detail.profitKurus,
        saleLineCount: detail.lines.length,
        openingCashKurus,
        expectedCashKurus,
        actualCashKurus: normalizedActualCashKurus,
        cashDiffKurus
      };
    },
    showItemInFolder: async () => undefined,
    exportXlsx: async (date) => `Web demo modunda Excel cikti kapali (${date}).`,
    exportMonthlyProfitXlsx: async (yearMonth) => `Web demo modunda aylik Excel cikti kapali (${yearMonth}).`
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
