import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Category, CategorySaleUnit, Product, StockEntryLogRow } from "../../types/models";
import { formatTry } from "../../utils/currency";
import {
  resolveStockEntryUnitCostKurus,
  stockCostModeLabel,
  stockEntryDisplayAmountKurus
} from "../../utils/stockCost";
import { categorySaleUnitOf, formatQtyShort, kurusPerGramToTlPer1000g } from "../../utils/saleUnit";
import { stockEntryLogDisplayItems } from "../../utils/stockEntryLogDisplay";
import type { SupplierStockBatch } from "../../utils/supplierStockBatches";
import {
  stockEntryRowCanDelete,
  stockEntryRowsCanEdit
} from "../../utils/stockEntryDelete";

function stockEntryUnitCostLabel(entry: StockEntryLogRow, unit: CategorySaleUnit): string {
  const kurus = resolveStockEntryUnitCostKurus(entry, unit);
  if (kurus == null || kurus <= 0) return "—";
  if (unit === "gram") return `${kurusPerGramToTlPer1000g(kurus)} / 1000 g`;
  return `${formatTry(kurus)} / adet`;
}

type MenuPayload =
  | { kind: "batch"; batch: SupplierStockBatch; anchor: StockEntryLogRow }
  | { kind: "single"; row: StockEntryLogRow };

type MenuState = MenuPayload & { x: number; y: number };

type Props = {
  entryLog: StockEntryLogRow[];
  products: Product[];
  categories: Category[];
  latestDeletableByProduct: Map<number, number>;
  deletingEntryId: number | null;
  formatDateTime: (iso: string) => string;
  onEdit: (row: StockEntryLogRow) => void;
  onDelete: (row: StockEntryLogRow) => void;
};

function batchSupplierName(batch: SupplierStockBatch): string {
  return batch.lines.find((l) => l.supplierName?.trim())?.supplierName ?? "—";
}

function BatchDetailTable({
  batch,
  products,
  categories
}: {
  batch: SupplierStockBatch;
  products: Product[];
  categories: Category[];
}) {
  return (
    <div className="stock-entry-batch-detail">
      <table className="cashflow-table stock-entry-batch-table">
        <thead>
          <tr>
            <th>Urun</th>
            <th>Kod</th>
            <th>Miktar</th>
            <th>Birim gelis</th>
            <th>Toplam</th>
          </tr>
        </thead>
        <tbody>
          {batch.lines.map((line) => {
            const p = products.find((x) => x.id === line.productId);
            const unit = line.saleUnit ?? (p ? categorySaleUnitOf(categories, p.categoryId) : "piece");
            const amt = stockEntryDisplayAmountKurus(line);
            return (
              <tr key={line.movementId}>
                <td>{line.productName}</td>
                <td>
                  <span className="closure-code">{line.productCode || "—"}</span>
                </td>
                <td>+{formatQtyShort(line.qty, unit)}</td>
                <td>{stockEntryUnitCostLabel(line, unit)}</td>
                <td>
                  {amt > 0 ? formatTry(amt) : "—"}
                  {(line.debtAddedKurus ?? 0) > 0 ? (
                    <span className="supplier-debt-badge supplier-debt-badge-inline">
                      {" "}
                      borc {formatTry(line.debtAddedKurus!)}
                    </span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {batch.lines[0]?.note ? <p className="muted small stock-entry-batch-note">{batch.lines[0].note}</p> : null}
    </div>
  );
}

function SingleDetailPanel({ row, unit }: { row: StockEntryLogRow; unit: CategorySaleUnit }) {
  return (
    <div className="stock-entry-batch-detail stock-entry-single-detail">
      <dl className="stock-entry-single-detail-dl">
        <div>
          <dt>Birim gelis</dt>
          <dd>{stockEntryUnitCostLabel(row, unit)}</dd>
        </div>
        <div>
          <dt>Toplam</dt>
          <dd>{row.lineCostKurus != null && row.lineCostKurus > 0 ? formatTry(row.lineCostKurus) : "—"}</dd>
        </div>
        <div>
          <dt>Not</dt>
          <dd>
            {row.costMode ? `[${stockCostModeLabel(row.costMode)}] ` : ""}
            {row.note || "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function StockEntryLogList({
  entryLog,
  products,
  categories,
  latestDeletableByProduct,
  deletingEntryId,
  formatDateTime,
  onEdit,
  onDelete
}: Props) {
  const displayItems = useMemo(() => stockEntryLogDisplayItems(entryLog), [entryLog]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);

  const closeMenu = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (t?.closest(".stock-entry-action-menu") || t?.closest(".stock-entry-menu-btn")) return;
      closeMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu, closeMenu]);

  const openMenuAt = (x: number, y: number, state: MenuPayload) => {
    const pad = 8;
    const menuW = 200;
    const menuH = 132;
    setMenu({
      ...state,
      x: Math.max(pad, Math.min(x, window.innerWidth - menuW - pad)),
      y: Math.max(pad, Math.min(y, window.innerHeight - menuH - pad))
    } as MenuState);
  };

  const toggleView = (key: string) => {
    setOpenKey((prev) => (prev === key ? null : key));
  };

  if (displayItems.length === 0) {
    return (
      <div className="stock-entry-row stock-entry-row--cost stock-entry-row--empty">
        <span>Kayit yok</span>
        <span>—</span>
        <span>—</span>
        <span>—</span>
        <span>—</span>
        <span>—</span>
        <span>—</span>
        <span>—</span>
        <span>—</span>
      </div>
    );
  }

  const menuCanEdit =
    menu?.kind === "batch"
      ? stockEntryRowsCanEdit(menu.batch.lines, latestDeletableByProduct, entryLog)
      : menu
        ? stockEntryRowsCanEdit([menu.row], latestDeletableByProduct, entryLog)
        : false;
  const menuCanDelete =
    menu?.kind === "batch"
      ? menuCanEdit
      : menu
        ? stockEntryRowCanDelete(menu.row, latestDeletableByProduct, entryLog)
        : false;

  return (
    <>
      {displayItems.map((item) => {
        if (item.kind === "single") {
          const row = item.row;
          const p = products.find((x) => x.id === row.productId);
          const unit = row.saleUnit ?? (p ? categorySaleUnitOf(categories, p.categoryId) : "piece");
          const viewKey = `single-${row.movementId}`;
          const open = openKey === viewKey;
          const deleting = deletingEntryId === row.movementId;

          return (
            <div key={row.movementId} className={`stock-entry-batch-wrap${open ? " is-open" : ""}`}>
              <motion.div
                role="button"
                tabIndex={0}
                className="stock-entry-row stock-entry-row--cost stock-entry-row--clickable"
                title="Tikla: giris detayi"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => toggleView(viewKey)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  openMenuAt(e.clientX, e.clientY, { kind: "single", row });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleView(viewKey);
                  }
                }}
              >
                <span>{formatDateTime(row.createdAt)}</span>
                <span title={row.productName}>{row.productName}</span>
                <span>{row.productCode || "—"}</span>
                <span title={row.supplierName}>{row.supplierName || "—"}</span>
                <span>+{formatQtyShort(row.qty, unit)}</span>
                <span>{stockEntryUnitCostLabel(row, unit)}</span>
                <span>{row.lineCostKurus != null && row.lineCostKurus > 0 ? formatTry(row.lineCostKurus) : "—"}</span>
                <span className="muted small">{open ? "▲ gizle" : "▼ detay"}</span>
                <span className="stock-entry-col-actions">
                  <button
                    type="button"
                    className="stock-entry-menu-btn"
                    disabled={deletingEntryId != null}
                    aria-label="Islemler"
                    title="Islemler"
                    onClick={(e) => {
                      e.stopPropagation();
                      const r = e.currentTarget.getBoundingClientRect();
                      openMenuAt(r.right, r.bottom + 4, { kind: "single", row });
                    }}
                  >
                    ⋯
                  </button>
                </span>
              </motion.div>
              {open ? <SingleDetailPanel row={row} unit={unit} /> : null}
            </div>
          );
        }

        const { batch } = item;
        const anchor = batch.lines[0];
        if (!anchor) return null;
        const viewKey = `batch-${batch.batchId}`;
        const open = openKey === viewKey;
        const deleting = batch.lines.some((l) => l.movementId === deletingEntryId);

        return (
          <div key={batch.batchId} className={`stock-entry-batch-wrap${open ? " is-open" : ""}`}>
            <motion.div
              role="button"
              tabIndex={0}
              className="stock-entry-row stock-entry-row--cost stock-entry-row--batch stock-entry-row--clickable"
              title="Tikla: fatura detayi"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => toggleView(viewKey)}
              onContextMenu={(e) => {
                e.preventDefault();
                openMenuAt(e.clientX, e.clientY, { kind: "batch", batch, anchor });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleView(viewKey);
                }
              }}
            >
              <span>{formatDateTime(batch.createdAt)}</span>
              <span title={batch.label}>
                <strong>{batch.label}</strong>
              </span>
              <span className="closure-code">
                {batch.batchId.startsWith("SRB-") || batch.batchId.startsWith("FAT-") ? batch.batchId : "—"}
              </span>
              <span title={batchSupplierName(batch)}>{batchSupplierName(batch)}</span>
              <span>{batch.lines.length} kalem</span>
              <span>—</span>
              <span>
                {formatTry(batch.totalLineCostKurus)}
                {batch.totalDebtKurus > 0 ? (
                  <span className="supplier-debt-badge supplier-debt-badge-inline">
                    {" "}
                    +borc {formatTry(batch.totalDebtKurus)}
                  </span>
                ) : null}
              </span>
              <span className="muted small">{open ? "▲ gizle" : "▼ detay"}</span>
              <span className="stock-entry-col-actions">
                <button
                  type="button"
                  className="stock-entry-menu-btn"
                  disabled={deletingEntryId != null}
                  aria-label="Fatura islemleri"
                  title="Islemler"
                  onClick={(e) => {
                    e.stopPropagation();
                    const r = e.currentTarget.getBoundingClientRect();
                    openMenuAt(r.right, r.bottom + 4, { kind: "batch", batch, anchor });
                  }}
                >
                  {deleting ? "…" : "⋯"}
                </button>
              </span>
            </motion.div>
            {open ? <BatchDetailTable batch={batch} products={products} categories={categories} /> : null}
          </div>
        );
      })}

      {menu ? (
        <ul
          className="stock-context-menu stock-entry-action-menu"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <li>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const key =
                  menu.kind === "batch" ? `batch-${menu.batch.batchId}` : `single-${menu.row.movementId}`;
                setOpenKey(key);
                closeMenu();
              }}
            >
              {menu.kind === "batch" ? "Faturayı gör" : "Girişi gör"}
            </button>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              disabled={!menuCanEdit || deletingEntryId != null}
              onClick={() => {
                const row = menu.kind === "batch" ? menu.anchor : menu.row;
                closeMenu();
                onEdit(row);
              }}
            >
              {menu.kind === "batch" ? "Faturayı düzelt" : "Girişi düzelt"}
            </button>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              className="stock-entry-menu-danger"
              disabled={!menuCanDelete || deletingEntryId != null}
              onClick={() => {
                const row = menu.kind === "batch" ? menu.anchor : menu.row;
                closeMenu();
                onDelete(row);
              }}
            >
              {menu.kind === "batch" ? "Faturayı sil" : "Girişi sil"}
            </button>
          </li>
        </ul>
      ) : null}
    </>
  );
}
