import { formatTry } from "../../utils/currency";
import type { InventoryTotals } from "../../utils/inventoryTotals";

type Props = {
  totals: InventoryTotals;
  /** Varsayilan: stok listesi metinleri */
  countLabel?: string;
  ariaLabel?: string;
};

export function StockInventorySummary({
  totals,
  countLabel = "Listede urun (satir)",
  ariaLabel = "Liste ozeti"
}: Props) {
  if (totals.skuCount <= 0 && totals.costKurus <= 0 && totals.revenueKurus <= 0) {
    return null;
  }
  return (
    <div className="stock-list-footer" aria-label={ariaLabel}>
      <div className="stock-list-footer-line">
        <span>{countLabel}</span>
        <strong>{totals.skuCount}</strong>
      </div>
      <div className="stock-list-footer-line">
        <span>Toplam stok maliyeti (gelis)</span>
        <strong>{formatTry(totals.costKurus)}</strong>
      </div>
      <div className="stock-list-footer-line">
        <span>Hepsi satilirsa tahmini ciro (liste, urun indirimi dahil)</span>
        <strong>{formatTry(totals.revenueKurus)}</strong>
      </div>
      <div className="stock-list-footer-line stock-list-footer-profit">
        <span>Tahmini brut kar (ciro - maliyet)</span>
        <strong>{formatTry(totals.profitKurus)}</strong>
      </div>
    </div>
  );
}
