import { useEffect, useMemo, useState } from "react";
import { getMarinaApi } from "../../api/marinaClient";
import type { Category, Product, Supplier } from "../../types/models";
import { categorySaleUnitOf, formatQtyShort, normalizeGramStockQty } from "../../utils/saleUnit";

type Props = {
  product: Product;
  categories: Category[];
  suppliers: Supplier[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

export function StockAdjustModal({ product, categories, suppliers, onClose, onSaved }: Props) {
  const unit = categorySaleUnitOf(categories, product.categoryId);
  const supplierName = useMemo(
    () => suppliers.find((s) => s.id === product.supplierId)?.name ?? "-",
    [suppliers, product.supplierId]
  );

  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCounted(unit === "gram" ? String(normalizeGramStockQty(product.stockQty)) : String(Math.round(product.stockQty)));
    setNote("");
  }, [product.id, product.stockQty, unit]);

  const submit = async () => {
    const n = Math.round(Number(String(counted).replace(",", ".")));
    if (!Number.isFinite(n) || n < 0) {
      window.alert("Stok miktari gecersiz.");
      return;
    }
    if (unit === "piece" && !Number.isInteger(n)) {
      window.alert("Adetli urunlerde stok tam sayi olmalidir.");
      return;
    }
    if (unit === "gram" && !Number.isInteger(n)) {
      window.alert("Gram stok tam sayi olmalidir.");
      return;
    }
    setSaving(true);
    try {
      await getMarinaApi().adjustStock(product.id, n, note.trim());
      await onSaved();
      onClose();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Stok guncellenemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="modal-dialog stock-list-adjust-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-list-adjust-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 id="stock-list-adjust-title">Stok sayim / duzelt</h3>
        <p className="stock-receive-product-name">{product.name}</p>
        <p className="stock-help small">
          Kayitli stok: <strong>{formatQtyShort(product.stockQty, unit)}</strong> — Kod: {product.code} — Tedarikci:{" "}
          {supplierName}
        </p>
        <label className="stock-receive-qty-label">
          {unit === "gram" ? "Gercek stok (gram)" : "Gercek stok (adet)"}
          <input
            type="number"
            min={0}
            step="1"
            value={counted}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") {
                setCounted("");
                return;
              }
              setCounted(unit === "gram" ? String(Math.max(0, Math.round(Number(v) || 0))) : v);
            }}
            disabled={saving}
            autoFocus
          />
        </label>
        <label className="stock-receive-qty-label">
          Not (istege bagli)
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={saving}
            placeholder="Orn. sayim, fire"
          />
        </label>
        <div className="modal-actions">
          <button type="button" disabled={saving} onClick={onClose}>
            Vazgec
          </button>
          <button type="button" className="primary" disabled={saving} onClick={() => void submit()}>
            {saving ? "Kaydediliyor..." : "Stogu guncelle"}
          </button>
        </div>
      </div>
    </div>
  );
}
