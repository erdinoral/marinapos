import type { StockEntryLogRow } from "../types/models";

type EntryLike = Pick<StockEntryLogRow, "productId" | "note" | "receiveBatchId" | "movementId">;

/** Gelen stok girisi (iade, borc odemesi haric) */
export function isDeletableStockEntryRow(row: Pick<StockEntryLogRow, "productId" | "note">): boolean {
  if (row.productId <= 0) return false;
  const note = String(row.note ?? "").trim().toLocaleLowerCase("tr");
  if (note === "iade" || note.startsWith("iade ")) return false;
  return true;
}

export function isBulkReceiveBatchId(batchId: string | undefined | null): boolean {
  const id = String(batchId ?? "").trim();
  return id.startsWith("SRB-");
}

/** Ayni toplu fatura / sepet grubundaki satirlar */
export function batchSiblingRows(
  row: Pick<StockEntryLogRow, "receiveBatchId" | "movementId">,
  entryLog: StockEntryLogRow[]
): StockEntryLogRow[] {
  const batchId = row.receiveBatchId?.trim();
  if (!batchId || !isBulkReceiveBatchId(batchId)) return [];
  return entryLog.filter((e) => e.receiveBatchId?.trim() === batchId);
}

/** Liste en yeni ustte; urun basina ilk uygun satir = son silinebilir giris */
export function latestDeletableMovementIdByProduct(
  rows: Pick<StockEntryLogRow, "productId" | "movementId" | "note">[]
): Map<number, number> {
  const map = new Map<number, number>();
  for (const row of rows) {
    if (!isDeletableStockEntryRow(row)) continue;
    if (!map.has(row.productId)) map.set(row.productId, row.movementId);
  }
  return map;
}

export function stockEntryRowCanDelete(
  row: EntryLike,
  latestByProduct: Map<number, number>,
  entryLog: StockEntryLogRow[]
): boolean {
  if (!isDeletableStockEntryRow(row)) return false;
  const siblings = batchSiblingRows(row, entryLog);
  if (siblings.length > 1) {
    return siblings.every((line) => latestByProduct.get(line.productId) === line.movementId);
  }
  return latestByProduct.get(row.productId) === row.movementId;
}

export function stockEntryRowsCanEdit(
  rows: EntryLike[],
  latestByProduct: Map<number, number>,
  entryLog: StockEntryLogRow[]
): boolean {
  if (rows.length === 0) return false;
  return rows.every((row) => stockEntryRowCanDelete(row, latestByProduct, entryLog));
}

export function stockEntryDeleteAction(
  row: Pick<StockEntryLogRow, "receiveBatchId" | "movementId">,
  entryLog: StockEntryLogRow[]
): { mode: "batch"; batchId: string; lineCount: number } | { mode: "single" } {
  const siblings = batchSiblingRows(row, entryLog);
  if (siblings.length > 1) {
    return { mode: "batch", batchId: row.receiveBatchId!.trim(), lineCount: siblings.length };
  }
  return { mode: "single" };
}
