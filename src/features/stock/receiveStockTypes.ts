import type { CategorySaleUnit, StockCostMode } from "../../types/models";

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
  remainingDebtTl: string;
  supplierId: number;
};
