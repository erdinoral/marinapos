import { useCallback, useEffect, useMemo, useState } from "react";
import { getMarinaApi } from "../../api/marinaClient";
import type { Category, CategorySaleUnit, Product, StockCostMode, Supplier } from "../../types/models";
import { formatTry, parseTrAmount, tlToKurus } from "../../utils/currency";
import { computeStockAddCosts } from "../../utils/stockCost";
import { categorySaleUnitOf, formatQtyShort, incomingCostTlToUnitCostKurus } from "../../utils/saleUnit";
import { StockCostFields } from "./StockCostFields";
import { buildStockAddInput, defaultCostTlForProduct } from "./stockAddHelpers";
import type { ReceiveCartLine } from "./receiveStockTypes";

type Props = {
  products: Product[];
  categories: Category[];
  suppliers: Supplier[];
  initialProduct?: Product | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

function newCartLineId() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseQty(raw: number, unit: CategorySaleUnit): number | null {
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const q = Math.round(raw);
  if (unit === "piece" && !Number.isInteger(raw)) return null;
  if (unit === "gram" && !Number.isInteger(q)) return null;
  return unit === "gram" ? q : raw;
}

export function ReceiveStockModal({ products, categories, suppliers, initialProduct, onClose, onSaved }: Props) {
  const [supplierId, setSupplierId] = useState(0);
  const [pickerProductId, setPickerProductId] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [qty, setQty] = useState(1);
  const [incomingCostTl, setIncomingCostTl] = useState("");
  const [costMode, setCostMode] = useState<StockCostMode>("product");
  const [invoicePaidTl, setInvoicePaidTl] = useState("");
  const [remainingDebtTl, setRemainingDebtTl] = useState("");
  const [cart, setCart] = useState<ReceiveCartLine[]>([]);
  const [expandedCartId, setExpandedCartId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeProducts = useMemo(() => products.filter((p) => p.isActive === 1), [products]);

  const selectedProduct = useMemo(() => {
    if (pickerProductId != null) {
      return activeProducts.find((p) => p.id === pickerProductId) ?? null;
    }
    return initialProduct ?? null;
  }, [pickerProductId, initialProduct, activeProducts]);

  const unit = selectedProduct ? categorySaleUnitOf(categories, selectedProduct.categoryId) : "piece";

  const supplierProducts = useMemo(() => {
    if (supplierId <= 0) return [];
    const q = productSearch.trim().toLowerCase();
    return activeProducts
      .filter((p) => p.supplierId === supplierId)
      .filter((p) => {
        if (!q) return true;
        const cat = categories.find((c) => c.id === p.categoryId)?.name ?? "";
        return [p.name, p.code, p.barcode, cat].join(" ").toLowerCase().includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [supplierId, activeProducts, productSearch, categories]);

  const showSupplierPicker = supplierId > 0 && supplierProducts.length > 0;

  const resetFormForProduct = useCallback(
    (p: Product) => {
      const u = categorySaleUnitOf(categories, p.categoryId);
      setPickerProductId(p.id);
      setQty(u === "gram" ? 1000 : 1);
      setIncomingCostTl(defaultCostTlForProduct(p, u));
      setCostMode("product");
      setInvoicePaidTl("");
      setRemainingDebtTl("");
    },
    [categories]
  );

  useEffect(() => {
    const p = initialProduct ?? null;
    if (!p) return;
    setSupplierId(p.supplierId > 0 ? p.supplierId : 0);
    resetFormForProduct(p);
  }, [initialProduct?.id, resetFormForProduct, initialProduct]);

  const onSupplierChange = (sid: number) => {
    setSupplierId(sid);
    setProductSearch("");
    if (sid <= 0) {
      setPickerProductId(initialProduct?.id ?? null);
      return;
    }
    const stillValid = pickerProductId != null && activeProducts.some((p) => p.id === pickerProductId && p.supplierId === sid);
    if (!stillValid) {
      const first = activeProducts.find((p) => p.supplierId === sid);
      if (first) resetFormForProduct(first);
      else setPickerProductId(null);
    }
  };

  const buildInputForCurrent = () => {
    if (!selectedProduct) {
      window.alert("Urun secin.");
      return null;
    }
    const raw = parseQty(Number(String(qty).replace(",", ".")), unit);
    if (raw == null) {
      window.alert(unit === "gram" ? "Gram miktar tam sayi olmalidir." : "Miktar gecersiz.");
      return null;
    }
    const sid = supplierId > 0 ? supplierId : selectedProduct.supplierId;
    const input = buildStockAddInput(selectedProduct, unit, costMode, incomingCostTl, invoicePaidTl, remainingDebtTl, sid);
    if (!input) return null;
    return { raw, input, sid };
  };

  const addToCart = () => {
    if (!selectedProduct) return;
    const built = buildInputForCurrent();
    if (!built) return;
    const line: ReceiveCartLine = {
      id: newCartLineId(),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      productCode: selectedProduct.code,
      saleUnit: unit,
      qty: built.raw,
      costMode,
      incomingCostTl,
      invoicePaidTl,
      remainingDebtTl,
      supplierId: built.sid
    };
    setCart((prev) => [...prev, line]);
    setExpandedCartId(line.id);
    const next = supplierProducts.find((p) => p.id !== selectedProduct.id);
    if (next) resetFormForProduct(next);
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((l) => l.id !== id));
    if (expandedCartId === id) setExpandedCartId(null);
  };

  const bumpCartQty = (lineId: string, add: number) => {
    setCart((prev) =>
      prev.map((l) => {
        if (l.id !== lineId || l.saleUnit !== "piece") return l;
        return { ...l, qty: Math.max(1, Math.round(l.qty + add)) };
      })
    );
  };

  const bumpFormQty = (add: number) => {
    if (unit !== "piece") return;
    setQty((q) => Math.max(1, Math.round(Number(q) + add)));
  };

  const commitLines = async (lines: ReceiveCartLine[], batchId?: string) => {
    const api = getMarinaApi();
    for (const line of lines) {
      const product = activeProducts.find((p) => p.id === line.productId);
      if (!product) continue;
      const input = buildStockAddInput(
        product,
        line.saleUnit,
        line.costMode,
        line.incomingCostTl,
        line.invoicePaidTl,
        line.remainingDebtTl,
        line.supplierId
      );
      if (!input) throw new Error(`"${line.productName}" satiri gecersiz.`);
      if (batchId) input.receiveBatchId = batchId;
      await api.addStock(product.id, line.qty, input);
    }
  };

  const submitSingle = async () => {
    if (!selectedProduct) return;
    const built = buildInputForCurrent();
    if (!built) return;
    setSaving(true);
    try {
      await getMarinaApi().addStock(selectedProduct.id, built.raw, built.input);
      await onSaved();
      onClose();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Stok eklenemedi.");
    } finally {
      setSaving(false);
    }
  };

  const submitCart = async () => {
    if (cart.length === 0) return;
    setSaving(true);
    try {
      const api = getMarinaApi();
      let batchId: string | undefined;
      if (cart.length > 1 && typeof api.nextReceiveBatchId === "function") {
        batchId = await api.nextReceiveBatchId();
      } else if (cart.length > 1) {
        batchId = `SRB-${Date.now()}`;
      }
      await commitLines(cart, batchId);
      await onSaved();
      onClose();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Stok eklenemedi.");
    } finally {
      setSaving(false);
    }
  };

  const previewLine = useCallback(
    (line: ReceiveCartLine) => {
      const product = activeProducts.find((p) => p.id === line.productId);
      if (!product) return { lineCost: 0, paid: 0, debt: 0 };
      let unitCatalogKurus = Math.max(0, product.costPriceKurus ?? 0);
      if (line.costMode === "product" && line.incomingCostTl.trim()) {
        const parsed = incomingCostTlToUnitCostKurus(line.incomingCostTl, line.saleUnit);
        if (parsed != null) unitCatalogKurus = parsed;
      }
      let invoicePaidKurus: number | undefined;
      if (line.costMode === "invoice") {
        const paid = parseTrAmount(line.invoicePaidTl);
        if (paid != null && paid > 0) invoicePaidKurus = tlToKurus(paid);
      }
      const costs = computeStockAddCosts({
        costMode: line.costMode,
        qty: line.qty,
        saleUnit: line.saleUnit,
        unitCatalogKurus,
        invoicePaidKurus
      });
      const debtParsed = parseTrAmount(line.remainingDebtTl);
      const debt = debtParsed != null && debtParsed > 0 ? tlToKurus(debtParsed) : 0;
      const paid = Math.max(0, costs.lineCostKurus - debt);
      return { lineCost: costs.lineCostKurus, paid, debt };
    },
    [activeProducts]
  );

  const cartTotals = useMemo(() => {
    let total = 0;
    let debt = 0;
    for (const line of cart) {
      const s = previewLine(line);
      total += s.lineCost;
      debt += s.debt;
    }
    return { total, debt, paid: total - debt };
  }, [cart, previewLine]);

  const supplierName = suppliers.find((s) => s.id === supplierId)?.name ?? "—";

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="modal-dialog stock-receive-dialog stock-receive-dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-receive-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 id="stock-receive-title">Gelen / stok ekle</h3>
        <p className="stock-help small">
          Tedarikci secerseniz o firmaya bagli urunler listelenir; her kalem sepete eklenir, tek fatura gibi kaydedilir.
        </p>

        <label className="stock-receive-qty-label">
          Tedarikci *
          <select value={supplierId} disabled={saving} onChange={(e) => onSupplierChange(Number(e.target.value))}>
            <option value={0}>Secilmedi (urun kartindaki tedarikci)</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.balanceOwedKurus > 0 ? ` — borc ${formatTry(s.balanceOwedKurus)}` : ""}
              </option>
            ))}
          </select>
        </label>

        {showSupplierPicker ? (
          <div className="stock-receive-picker-layout">
            <div className="stock-receive-supplier-block">
              <label className="stock-receive-qty-label">
                {supplierName} urunleri ({supplierProducts.length})
                <input
                  type="search"
                  placeholder="Urun, kod, kategori ara..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  disabled={saving}
                />
              </label>
              <ul className="stock-receive-product-pick" role="listbox" aria-label="Tedarikci urunleri">
                {supplierProducts.map((p) => {
                  const u = categorySaleUnitOf(categories, p.categoryId);
                  const catName = categories.find((c) => c.id === p.categoryId)?.name ?? "";
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={pickerProductId === p.id}
                        className={pickerProductId === p.id ? "active" : ""}
                        onClick={() => resetFormForProduct(p)}
                        disabled={saving}
                      >
                        <span className="stock-receive-pick-name">
                          <span className="closure-code">{p.code}</span> {p.name}
                        </span>
                        <span className="stock-receive-pick-meta muted small">
                          {catName} · {formatQtyShort(p.stockQty, u)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            {selectedProduct ? (
              <div className="stock-receive-detail-panel">
                <div className="stock-receive-detail-top">
                  <div className="stock-receive-detail-fields">
                    <p className="stock-receive-product-name">{selectedProduct.name}</p>
                    <p className="stock-help small">
                      Mevcut: <strong>{formatQtyShort(selectedProduct.stockQty, unit)}</strong>
                    </p>
                    <label className="stock-receive-qty-label stock-receive-qty-label--inline">
                      {unit === "gram" ? "Eklenecek gram" : "Eklenecek adet"}
                      <div className="stock-receive-qty-row">
                        <input
                          type="number"
                          min={1}
                          step="1"
                          value={qty}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            setQty(unit === "gram" ? Math.max(1, Math.round(n || 0)) : Math.max(1, Math.round(n || 1)));
                          }}
                          disabled={saving}
                        />
                        {unit === "piece" ? (
                          <div className="stock-receive-qty-bump" aria-label="Adet hizli artir">
                            <button type="button" disabled={saving} onClick={() => bumpFormQty(5)}>
                              +5
                            </button>
                            <button
                              type="button"
                              className="stock-receive-qty-bump-10"
                              disabled={saving}
                              onClick={() => bumpFormQty(10)}
                            >
                              +10
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </label>
                  </div>
                  <div className="stock-receive-detail-actions">
                    <button type="button" className="app-btn-secondary" disabled={saving} onClick={addToCart}>
                      Sepete ekle
                    </button>
                  </div>
                </div>
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
                  product={selectedProduct}
                />
              </div>
            ) : (
              <p className="muted small">Stok eklemek icin urun secin.</p>
            )}
          </div>
        ) : supplierId > 0 ? (
          <p className="muted small">Bu tedarikciye bagli aktif urun yok. Urun kartinda tedarikci atayin.</p>
        ) : null}

        {!showSupplierPicker && selectedProduct ? (
          <>
            <p className="stock-receive-product-name">{selectedProduct.name}</p>
            <p className="stock-help small">
              Mevcut: <strong>{formatQtyShort(selectedProduct.stockQty, unit)}</strong>
            </p>
            <label className="stock-receive-qty-label">
              {unit === "gram" ? "Eklenecek gram" : "Eklenecek adet"}
              <div className="stock-receive-qty-row">
                <input
                  type="number"
                  min={1}
                  step="1"
                  value={qty}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setQty(unit === "gram" ? Math.max(1, Math.round(n || 0)) : Math.max(1, Math.round(n || 1)));
                  }}
                  disabled={saving}
                />
                {unit === "piece" ? (
                  <div className="stock-receive-qty-bump" aria-label="Adet hizli artir">
                    <button type="button" disabled={saving} onClick={() => bumpFormQty(5)}>
                      +5
                    </button>
                    <button type="button" className="stock-receive-qty-bump-10" disabled={saving} onClick={() => bumpFormQty(10)}>
                      +10
                    </button>
                  </div>
                ) : null}
              </div>
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
              product={selectedProduct}
            />
          </>
        ) : !showSupplierPicker ? (
          <p className="muted small">Stok eklemek icin urun secin.</p>
        ) : null}

        {cart.length > 0 ? (
          <section className="stock-receive-cart" aria-label="Gelen stok sepeti">
            <div className="stock-receive-cart-head">
              <strong>Sepet ({cart.length} kalem)</strong>
              <span className="muted small">
                Toplam {formatTry(cartTotals.total)}
                {cartTotals.debt > 0 ? ` · borc ${formatTry(cartTotals.debt)}` : ""}
              </span>
            </div>
            <ul className="stock-receive-cart-list">
              {cart.map((line) => {
                const summary = previewLine(line);
                const open = expandedCartId === line.id;
                return (
                  <li key={line.id} className={open ? "is-open" : ""}>
                    <div className="stock-receive-cart-line-row">
                      <button
                        type="button"
                        className="stock-receive-cart-line-btn"
                        onClick={() => setExpandedCartId(open ? null : line.id)}
                      >
                        <span>
                          <span className="closure-code">{line.productCode}</span> {line.productName} —{" "}
                          {formatQtyShort(line.qty, line.saleUnit)}
                        </span>
                        <span>{formatTry(summary.lineCost)}</span>
                      </button>
                      {line.saleUnit === "piece" ? (
                        <div
                          className="stock-receive-qty-bump stock-receive-cart-line-bump"
                          aria-label="Sepette adet artir"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <button type="button" disabled={saving} onClick={() => bumpCartQty(line.id, 5)}>
                            +5
                          </button>
                          <button
                            type="button"
                            className="stock-receive-qty-bump-10"
                            disabled={saving}
                            onClick={() => bumpCartQty(line.id, 10)}
                          >
                            +10
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {open ? (
                      <div className="stock-receive-cart-detail">
                        <p className="muted small">
                          Miktar: <strong>{formatQtyShort(line.qty, line.saleUnit)}</strong>
                          {line.saleUnit === "piece" ? (
                            <>
                              {" "}
                              ·{" "}
                              <button type="button" className="stock-receive-cart-qty-link" disabled={saving} onClick={() => bumpCartQty(line.id, 5)}>
                                +5 adet
                              </button>
                              <button type="button" className="stock-receive-cart-qty-link stock-receive-qty-bump-10" disabled={saving} onClick={() => bumpCartQty(line.id, 10)}>
                                +10 adet
                              </button>
                            </>
                          ) : null}
                        </p>
                        <p className="muted small">
                          Mod: {line.costMode === "invoice" ? "Odenen fatura" : "Urun bazli"} · Odenen:{" "}
                          {formatTry(summary.paid)}
                          {summary.debt > 0 ? ` · Borc ${formatTry(summary.debt)}` : ""}
                        </p>
                        <button type="button" className="stock-receive-cart-remove" onClick={() => removeFromCart(line.id)}>
                          Sepetten cikar
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <p className="stock-help small">
          Sepet bosken tek kalem dogrudan kaydedilir. Birden fazla kalem tek fatura grubu (SRB) olarak tedarikci gecmisinde
          gorunur.
        </p>
        <div className="modal-actions">
          <button type="button" disabled={saving} onClick={onClose}>
            Vazgec
          </button>
          {cart.length > 0 ? (
            <button type="button" className="primary" disabled={saving} onClick={() => void submitCart()}>
              {saving ? "Kaydediliyor..." : `Tumunu kaydet (${cart.length})`}
            </button>
          ) : (
            <button type="button" className="primary" disabled={saving || !selectedProduct} onClick={() => void submitSingle()}>
              {saving ? "Ekleniyor..." : unit === "gram" ? "Stoka gram ekle" : "Stoka adet ekle"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
