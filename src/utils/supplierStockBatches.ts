import type { StockEntryLogRow } from "../types/models";
import { stockEntryDisplayAmountKurus } from "./stockCost";

export type SupplierStockBatch = {
  batchId: string;
  label: string;
  createdAt: string;
  lines: StockEntryLogRow[];
  totalLineCostKurus: number;
  totalDebtKurus: number;
  totalPaidKurus: number;
};

export function groupStockEntriesIntoBatches(entries: StockEntryLogRow[]): SupplierStockBatch[] {
  const map = new Map<string, StockEntryLogRow[]>();
  for (const e of entries) {
    const key = e.receiveBatchId?.trim() || `tek-${e.movementId}`;
    const arr = map.get(key) ?? [];
    arr.push(e);
    map.set(key, arr);
  }
  const batches: SupplierStockBatch[] = [];
  for (const [batchId, lines] of map) {
    const sorted = lines.slice().sort((a, b) => a.movementId - b.movementId);
    let totalLineCostKurus = 0;
    let totalDebtKurus = 0;
    let totalPaidKurus = 0;
    for (const ln of sorted) {
      totalLineCostKurus += stockEntryDisplayAmountKurus(ln);
      totalDebtKurus += ln.debtAddedKurus ?? 0;
      totalPaidKurus += ln.amountPaidKurus ?? 0;
    }
    const isMulti = sorted.length > 1 || batchId.startsWith("SRB-");
    batches.push({
      batchId,
      label: isMulti ? `Fatura / sepet (${sorted.length} kalem)` : sorted[0]?.productName ?? "Stok girisi",
      createdAt: sorted.reduce((max, ln) => (ln.createdAt > max ? ln.createdAt : max), sorted[0]?.createdAt ?? ""),
      lines: sorted,
      totalLineCostKurus,
      totalDebtKurus,
      totalPaidKurus
    });
  }
  return batches.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
