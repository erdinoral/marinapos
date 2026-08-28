import type { CategorySaleUnit, StockEntryLogRow } from "../types/models";
import type { EditReceiveInvoice, ReceiveCartLine } from "../features/stock/receiveStockTypes";
import { kurusPerGramToTlPer1000g } from "./saleUnit";
import { resolveStockEntryUnitCostKurus, stockEntryDisplayAmountKurus } from "./stockCost";

function newCartLineId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function incomingTlFromUnitKurus(kurus: number, unit: CategorySaleUnit): string {
  if (kurus <= 0) return "";
  return unit === "gram" ? kurusPerGramToTlPer1000g(kurus).toFixed(2) : (kurus / 100).toFixed(2);
}

export function stockEntryRowToCartLine(row: StockEntryLogRow): ReceiveCartLine {
  const unit = row.saleUnit ?? "piece";
  const costMode = row.costMode ?? "product";
  let incomingCostTl = "";
  let invoicePaidTl = "";
  if (costMode === "product") {
    const unitKurus = resolveStockEntryUnitCostKurus(row, unit);
    if (unitKurus != null && unitKurus > 0) {
      incomingCostTl = incomingTlFromUnitKurus(unitKurus, unit);
    }
  } else if (row.invoicePaidKurus != null && row.invoicePaidKurus > 0) {
    invoicePaidTl = (row.invoicePaidKurus / 100).toFixed(2);
  }
  const lineCostKurus = stockEntryDisplayAmountKurus(row);
  const debtKurus = row.debtAddedKurus ?? 0;
  const paidKurus = row.amountPaidKurus ?? Math.max(0, lineCostKurus - debtKurus);
  const linePaidTl =
    debtKurus > 0 || (paidKurus > 0 && paidKurus < lineCostKurus) ? (paidKurus / 100).toFixed(2) : "";
  return {
    id: newCartLineId(),
    productId: row.productId,
    productName: row.productName,
    productCode: row.productCode,
    saleUnit: unit,
    qty: row.qty,
    costMode,
    incomingCostTl,
    invoicePaidTl,
    linePaidTl,
    supplierId: row.supplierId ?? 0
  };
}

function invoiceTotalPaidTlFromLines(lines: StockEntryLogRow[]): string {
  let totalKurus = 0;
  let debtKurus = 0;
  let paidKurus = 0;
  for (const ln of lines) {
    totalKurus += stockEntryDisplayAmountKurus(ln);
    debtKurus += ln.debtAddedKurus ?? 0;
    paidKurus += ln.amountPaidKurus ?? 0;
  }
  if (totalKurus <= 0) return "";
  const paid = paidKurus > 0 ? paidKurus : totalKurus - debtKurus;
  if (debtKurus <= 0 && paid >= totalKurus) return "";
  return (Math.min(paid, totalKurus) / 100).toFixed(2);
}

export function buildEditInvoiceFromBatch(batchId: string, lines: StockEntryLogRow[]): EditReceiveInvoice {
  const sorted = lines.slice().sort((a, b) => a.movementId - b.movementId);
  const supplierId = sorted.find((l) => (l.supplierId ?? 0) > 0)?.supplierId ?? sorted[0]?.supplierId ?? 0;
  return {
    kind: "batch",
    batchId,
    supplierId,
    cart: sorted.map(stockEntryRowToCartLine),
    invoiceTotalPaidTl: invoiceTotalPaidTlFromLines(sorted)
  };
}

export function buildEditInvoiceFromSingleRow(row: StockEntryLogRow): EditReceiveInvoice {
  return {
    kind: "single",
    movementId: row.movementId,
    supplierId: row.supplierId ?? 0,
    cart: [stockEntryRowToCartLine(row)],
    invoiceTotalPaidTl: invoiceTotalPaidTlFromLines([row])
  };
}
