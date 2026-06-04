import { useEffect, useMemo, useState } from "react";
import { getMarinaApi } from "../../api/marinaClient";
import type { Category, Product, StockCostMode, Supplier } from "../../types/models";
import { formatTry } from "../../utils/currency";
import { categorySaleUnitOf, formatQtyShort } from "../../utils/saleUnit";
import { StockCostFields } from "./StockCostFields";
import { buildStockAddInput, defaultCostTlForProduct } from "./stockAddHelpers";

type Props = {
  product: Product;
  categories: Category[];
  suppliers: Supplier[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

export function ReceiveStockModal({ product, categories, suppliers, onClose, onSaved }: Props) {
  const unit = categorySaleUnitOf(categories, product.categoryId);
  const supplierName = useMemo(
    () => suppliers.find((s) => s.id === product.supplierId)?.name ?? "-",
    [suppliers, product.supplierId]
  );

  const [qty, setQty] = useState(unit === "gram" ? 1000 : 1);
  const [incomingCostTl, setIncomingCostTl] = useState("");
  const [costMode, setCostMode] = useState<StockCostMode>("product");
  const [invoicePaidTl, setInvoicePaidTl] = useState("");
  const [remainingDebtTl, setRemainingDebtTl] = useState("");
  const [supplierId, setSupplierId] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setQty(unit === "gram" ? 1000 : 1);
    setSupplierId(product.supplierId > 0 ? product.supplierId : 0);
    setIncomingCostTl(defaultCostTlForProduct(product, unit));
    setCostMode("product");
    setInvoicePaidTl("");
    setRemainingDebtTl("");
  }, [product.id, unit, product.supplierId, product.costPriceKurus]);

  const submit = async () => {
    const raw = Math.round(Number(String(qty).replace(",", ".")));
    if (!Number.isFinite(raw) || raw <= 0) {
      window.alert("Miktar gecersiz.");
      return;
    }
    if (unit === "piece" && !Number.isInteger(raw)) {
      window.alert("Adetli urunlerde miktar tam sayi olmalidir.");
      return;
    }
    if (unit === "gram" && !Number.isInteger(raw)) {
      window.alert("Gram miktar tam sayi olmalidir.");
      return;
    }
    const input = buildStockAddInput(product, unit, costMode, incomingCostTl, invoicePaidTl, remainingDebtTl, supplierId);
    if (!input) return;
    setSaving(true);
    try {
      await getMarinaApi().addStock(product.id, raw, input);
      await onSaved();
      onClose();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Stok eklenemedi.");
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
        className="modal-dialog stock-receive-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-receive-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 id="stock-receive-title">Gelen / stok ekle</h3>
        <p className="stock-receive-product-name">{product.name}</p>
        <p className="stock-help small">
          Mevcut: <strong>{formatQtyShort(product.stockQty, unit)}</strong> — Tedarikci: {supplierName}
        </p>
        <label className="stock-receive-qty-label">
          {unit === "gram" ? "Eklenecek gram" : "Eklenecek adet"}
          <input
            type="number"
            min={1}
            step="1"
            value={qty}
            onChange={(e) => {
              const n = Number(e.target.value);
              setQty(unit === "gram" ? Math.max(1, Math.round(n || 0)) : n);
            }}
            disabled={saving}
          />
        </label>
        <label className="stock-receive-qty-label">
          Tedarikci *
          <select value={supplierId} disabled={saving} onChange={(e) => setSupplierId(Number(e.target.value))}>
            <option value={0}>Tedarikci secin</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.balanceOwedKurus > 0 ? ` — borc ${formatTry(s.balanceOwedKurus)}` : ""}
              </option>
            ))}
          </select>
        </label>
        <StockCostFields
          saleUnit={unit}
          qty={qty}
          costMode={costMode}
          onCostModeChange={setCostMode}
          incomingCostTl={incomingCostTl}
          onIncomingCostTlChange={setIncomingCostTl}
          invoicePaidTl={invoicePaidTl}
          onInvoicePaidTlChange={setInvoicePaidTl}
          remainingDebtTl={remainingDebtTl}
          onRemainingDebtTlChange={setRemainingDebtTl}
          disabled={saving}
          product={product}
        />
        <p className="stock-help small">
          Miktar, maliyet ve tedarikci kaydi ilgili tedarikci gecmisine yazilir; gider gelir-gidere yansir.
        </p>
        <div className="modal-actions">
          <button type="button" disabled={saving} onClick={onClose}>
            Vazgec
          </button>
          <button type="button" className="primary" disabled={saving} onClick={() => void submit()}>
            {saving ? "Ekleniyor..." : unit === "gram" ? "Stoka gram ekle" : "Stoka adet ekle"}
          </button>
        </div>
      </div>
    </div>
  );
}
