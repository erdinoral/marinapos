export type PaymentType = "cash" | "card";
export type SaleKind = "sale" | "return";

export interface Product {
  id: number;
  name: string;
  description: string;
  barcode: string;
  code: string;
  priceKurus: number;
  /** Birim gelis maliyeti (kurus) */
  costPriceKurus: number;
  stockQty: number;
  imagePath: string;
  categoryId: number;
  isActive: number;
}

export interface ProductInput {
  name: string;
  description: string;
  barcode: string;
  code: string;
  priceKurus: number;
  costPriceKurus: number;
  stockQty: number;
  imagePath: string;
  categoryId: number;
}

export interface Category {
  id: number;
  name: string;
}

export interface CartItem extends Product {
  qty: number;
}

export interface SaleRecord {
  id: number;
  createdAt: string;
  kind: SaleKind;
  paymentType: PaymentType;
  subtotalKurus: number;
  paidAmountKurus: number;
  changeAmountKurus: number;
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
  unitCostKurus: number;
  unitPriceKurus: number;
  lineCostKurus: number;
  lineTotalKurus: number;
  lineProfitKurus: number;
}

export interface DayProfitDetail {
  revenueKurus: number;
  costTotalKurus: number;
  profitKurus: number;
  lines: DayProfitLine[];
}

export interface Settings {
  openingTime: string;
  closureTime: string;
  lowStockThreshold: number;
  openingCashKurus: number;
  openingCashDate: string;
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

export interface StockEntryLogRow {
  movementId: number;
  createdAt: string;
  productId: number;
  productName: string;
  productCode: string;
  qty: number;
  note: string;
}

/** Gunluk kapanis raporu (runClosure sonucu) */
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
      listCategories: () => Promise<Category[]>;
      createCategory: (name: string) => Promise<Category>;
      createProduct: (payload: ProductInput) => Promise<void>;
      addStock: (productId: number, quantity: number) => Promise<void>;
      adjustStock: (productId: number, countedQty: number, note?: string) => Promise<void>;
      lowStock: () => Promise<Product[]>;
      selectImage: () => Promise<string>;
      createSale: (
        items: Array<{ productId: number; qty: number }>,
        paymentType: PaymentType,
        paidAmount: number,
        kind?: SaleKind
      ) => Promise<void>;
      getDailySales: (date: string) => Promise<SaleRecord[]>;
      getDayProfitDetail: (date: string) => Promise<DayProfitDetail>;
      getStockAging: () => Promise<StockAgingRow[]>;
      getStockEntryLog: () => Promise<StockEntryLogRow[]>;
      getSettings: () => Promise<Settings>;
      setOpeningTime: (openingTime: string) => Promise<void>;
      setClosureTime: (closureTime: string) => Promise<void>;
      setOpeningCash: (amountKurus: number) => Promise<void>;
      runClosure: (actualCashKurus?: number) => Promise<ClosureRunResult>;
      showItemInFolder: (fullPath: string) => Promise<void>;
      exportXlsx: (date: string) => Promise<string>;
      exportMonthlyProfitXlsx: (yearMonth: string) => Promise<string>;
    };
  }
}
