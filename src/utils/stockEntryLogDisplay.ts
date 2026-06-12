import type { StockEntryLogRow } from "../types/models";
import { groupStockEntriesIntoBatches, isGroupedStockBatch, type SupplierStockBatch } from "./supplierStockBatches";

export type StockEntryLogDisplayItem =
  | { kind: "single"; row: StockEntryLogRow }
  | { kind: "batch"; batch: SupplierStockBatch };

/** Toplu fatura (SRB / cok kalem) tek satir; tekli girisler ayri */
export function stockEntryLogDisplayItems(entries: StockEntryLogRow[]): StockEntryLogDisplayItem[] {
  return groupStockEntriesIntoBatches(entries).map((batch) => {
    const isGrouped = isGroupedStockBatch(batch.batchId, batch.lines.length);
    if (isGrouped) return { kind: "batch", batch };
    const row = batch.lines[0];
    if (!row) return { kind: "batch", batch };
    return { kind: "single", row };
  });
}
