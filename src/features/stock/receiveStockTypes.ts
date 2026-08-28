import type { CategorySaleUnit, StockCostMode } from "../../types/models";

export type ReceiveStockPrefill = {
  incomingCostTl?: string;
  costMode?: StockCostMode;
  invoicePaidTl?: string;
  linePaidTl?: string;
  supplierId?: number;
};

export type ReceiveCartLine = {
  id: string;
  productId: number;
  productName: string;
  productCode: string;
  saleUnit: CategorySaleUnit;
  qty: number;
  costMode: StockCostMode;
  incomingCostTl: string;
  invoicePaidTl: string;
  linePaidTl: string;
  supplierId: number;
};

/** Mevcut fatura / stok girisini duzenleme */
export type EditReceiveInvoice =
  | {
      kind: "batch";
      batchId: string;
      supplierId: number;
      cart: ReceiveCartLine[];
      invoiceTotalPaidTl: string;
    }
  | {
      kind: "single";
      movementId: number;
      supplierId: number;
      cart: ReceiveCartLine[];
      invoiceTotalPaidTl: string;
    };
