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
  const valueKey = `${totals.skuCount}-${totals.costKurus}-${totals.revenueKurus}-${totals.profitKurus}`;
  return (
    <div className="stock-list-footer" aria-label={ariaLabel} data-inventory-key={valueKey}>
      <div className="stock-list-footer-line">
        <span>{countLabel}</span>
        <strong>{totals.skuCount}</strong>
      </div>
      <div className="stock-list-footer-line">
        <span>Toplam stok maliyeti (gelis) — stok adedine gore</span>
        <strong key={`c-${totals.costKurus}`}>{formatTry(totals.costKurus)}</strong>
      </div>
      <div className="stock-list-footer-line">
        <span>Hepsi satilirsa tahmini ciro — stok adedi × liste fiyati</span>
        <strong key={`r-${totals.revenueKurus}`}>{formatTry(totals.revenueKurus)}</strong>
      </div>
      <div className="stock-list-footer-line stock-list-footer-profit">
        <span>Tahmini brut kar (ciro - maliyet)</span>
        <strong key={`p-${totals.profitKurus}`}>{formatTry(totals.profitKurus)}</strong>
      </div>
      <p className="stock-help small stock-list-footer-note">
        Birim satis fiyati degismez; stok azalinca yukaridaki <em>toplam tutarlar</em> duser.
      </p>
    </div>
  );
}
