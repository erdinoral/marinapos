/** POS asistan cekirdegi — baska projeye kopyalanabilir; UI ve veri adaptoru disarida kalir. */

export type AssistantReplySource = "faq" | "live" | "fallback";

export interface AssistantReply {
  text: string;
  source: AssistantReplySource;
  intentId?: string;
  /** Canli sorgu zamani (ISO) */
  fetchedAt?: string;
  suggestions?: string[];
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  source?: AssistantReplySource;
  intentId?: string;
  at: string;
}

export interface PosAssistantConfig {
  /** Gosterim adi (ornek: "Akiyom POS" veya lab etiketi) */
  displayName: string;
  /** true: entegrasyon testi / henuz uretim degil */
  labMode?: boolean;
  version?: string;
}

/** Host POS'un implement etmesi gereken salt-okunur veri koprusu */
export interface PosAssistantDataPort {
  getTodayIso(): string;
  fetchLowStock(): Promise<LowStockRow[]>;
  fetchTodaySalesSummary(): Promise<TodaySalesSummary>;
  fetchDashboardSnapshot(): Promise<DashboardSnapshot>;
  fetchCustomerDebtSummary(): Promise<CustomerDebtSummary>;
  fetchSupplierDebtSummary(): Promise<SupplierDebtSummary>;
  /** Urun adi/kod parcasi ile kisa stok bilgisi; bulunamazsa null */
  findProductHint(query: string): Promise<string | null>;
}

export interface LowStockRow {
  name: string;
  code: string;
  stockQty: number;
  threshold: number;
  saleUnit: "piece" | "gram";
}

export interface TodaySalesSummary {
  date: string;
  saleCount: number;
  revenueKurus: number;
  profitKurus: number;
  returnCount: number;
}

export interface DashboardSnapshot {
  productsCount: number;
  lowStockCount: number;
  totalSalesCount: number;
  revenueKurus: number;
  profitKurus: number;
}

export interface CustomerDebtSummary {
  retailDebtKurus: number;
  wholesaleDebtKurus: number;
  debtorCount: number;
  topDebtors: { name: string; balanceKurus: number; kind: string }[];
}

export interface SupplierDebtSummary {
  totalDebtKurus: number;
  debtorCount: number;
  topDebtors: { name: string; balanceKurus: number }[];
}

export interface FaqEntry {
  id: string;
  title: string;
  /** Anahtar kelimeler (normalize edilmis kucuk harf, turkce) */
  keywords: string[];
  body: string;
}

export interface LiveIntent {
  id: string;
  title: string;
  keywords: string[];
  run: (port: PosAssistantDataPort) => Promise<string>;
}
