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

function batchKeyForEntry(e: StockEntryLogRow): string {
  const explicit = e.receiveBatchId?.trim();
  if (explicit) return explicit;
  const fromNote = e.note?.match(/Grup\s+(SRB-\d+)/i)?.[1];
  if (fromNote) return fromNote;
  return `tek-${e.movementId}`;
}

/** Ayni saniye + tedarikci (eski toplu kayitlar SRB olmadan) */
function mergeLegacySameSecondBatches(map: Map<string, StockEntryLogRow[]>): void {
  const clusters = new Map<string, StockEntryLogRow[]>();
  for (const [key, lines] of map) {
    if (!key.startsWith("tek-") || lines.length !== 1) continue;
    const e = lines[0];
    const clusterKey = `${e.supplierId ?? 0}|${e.createdAt.slice(0, 19)}`;
    const arr = clusters.get(clusterKey) ?? [];
    arr.push(e);
    clusters.set(clusterKey, arr);
  }
  for (const [clusterKey, lines] of clusters) {
    if (lines.length < 2) continue;
    const synKey = `FAT-${clusterKey}`;
    for (const e of lines) {
      map.delete(`tek-${e.movementId}`);
    }
    map.set(synKey, lines);
  }
}

export function isGroupedStockBatch(batchId: string, lineCount: number): boolean {
  return lineCount > 1 || batchId.startsWith("SRB-") || batchId.startsWith("FAT-");
}

export function groupStockEntriesIntoBatches(entries: StockEntryLogRow[]): SupplierStockBatch[] {
  const map = new Map<string, StockEntryLogRow[]>();
  for (const e of entries) {
    const key = batchKeyForEntry(e);
    const arr = map.get(key) ?? [];
    arr.push(e);
    map.set(key, arr);
  }
  mergeLegacySameSecondBatches(map);
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
    const isMulti = isGroupedStockBatch(batchId, sorted.length);
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
