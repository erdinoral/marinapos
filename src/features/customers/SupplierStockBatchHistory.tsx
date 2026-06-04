import { useMemo, useState } from "react";
import type { StockEntryLogRow } from "../../types/models";
import { formatTry } from "../../utils/currency";
import { formatQtyShort } from "../../utils/saleUnit";
import { stockEntryDisplayAmountKurus } from "../../utils/stockCost";
import { groupStockEntriesIntoBatches } from "../../utils/supplierStockBatches";

type Props = {
  entries: StockEntryLogRow[];
  formatTime: (iso: string) => string;
  unitCostLabel: (entry: Pick<StockEntryLogRow, "unitCostKurus" | "saleUnit">) => string;
};

export function SupplierStockBatchHistory({ entries, formatTime, unitCostLabel }: Props) {
  const batches = useMemo(() => groupStockEntriesIntoBatches(entries), [entries]);
  const [openBatchId, setOpenBatchId] = useState<string | null>(null);

  if (batches.length === 0) {
    return <p className="muted small">Stok girisi yok.</p>;
  }

  return (
    <ul className="supplier-stock-batch-list">
      {batches.map((batch) => {
        const open = openBatchId === batch.batchId;
        const isMulti = batch.lines.length > 1 || batch.batchId.startsWith("SRB-");
        return (
          <li key={batch.batchId} className={`supplier-stock-batch${open ? " is-open" : ""}`}>
            <button
              type="button"
              className="supplier-stock-batch-head"
              onClick={() => setOpenBatchId(open ? null : batch.batchId)}
            >
              <span>
                <strong>{isMulti ? batch.label : batch.lines[0]?.productName ?? batch.label}</strong>
                <span className="muted small supplier-stock-batch-meta">
                  {formatTime(batch.createdAt)}
                  {isMulti ? ` · ${batch.batchId}` : ""}
                </span>
              </span>
              <span className="supplier-stock-batch-total">
                {formatTry(batch.totalLineCostKurus)}
                {batch.totalDebtKurus > 0 ? (
                  <span className="supplier-debt-badge supplier-debt-badge-inline"> borc {formatTry(batch.totalDebtKurus)}</span>
                ) : null}
              </span>
            </button>
            {open ? (
              <div className="supplier-stock-batch-detail">
                <table className="cashflow-table supplier-stock-batch-table">
                  <thead>
                    <tr>
                      <th>Urun</th>
                      <th>Miktar</th>
                      <th>Birim gelis</th>
                      <th>Toplam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.lines.map((e) => (
                      <tr key={e.movementId}>
                        <td>
                          <span className="closure-code">{e.productCode}</span> {e.productName}
                        </td>
                        <td>{formatQtyShort(e.qty, e.saleUnit ?? "piece")}</td>
                        <td>{unitCostLabel(e)}</td>
                        <td>
                          {(() => {
                            const amt = stockEntryDisplayAmountKurus(e);
                            return amt > 0 ? formatTry(amt) : "—";
                          })()}
                          {(e.debtAddedKurus ?? 0) > 0 ? (
                            <span className="supplier-debt-badge supplier-debt-badge-inline">
                              {" "}
                              borc {formatTry(e.debtAddedKurus!)}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {batch.lines[0]?.note ? <p className="muted small">{batch.lines[0].note}</p> : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
