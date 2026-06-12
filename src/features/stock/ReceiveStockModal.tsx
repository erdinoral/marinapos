import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMarinaApi } from "../../api/marinaClient";
import type { Category, CategorySaleUnit, Product, StockCostMode, Supplier } from "../../types/models";
import { formatTry, parseTrAmount, tlToKurus } from "../../utils/currency";
import { computeStockAddCosts } from "../../utils/stockCost";
import { bumpPieceQty, categorySaleUnitOf, formatQtyShort, incomingCostTlToUnitCostKurus } from "../../utils/saleUnit";
import { StockCostFields } from "./StockCostFields";
import { buildStockAddInput, defaultCostTlForProduct } from "./stockAddHelpers";
import { productHasSupplier, productSupplierIds } from "../../utils/productSuppliers";
import { clearBulkInvoiceDraft, loadBulkInvoiceDraft, saveBulkInvoiceDraft } from "./bulkInvoiceDraft";
import type { ReceiveCartLine, ReceiveStockPrefill } from "./receiveStockTypes";

type Props = {
  products: Product[];
  categories: Category[];
  suppliers: Supplier[];
  initialProduct?: Product | null;
  /** Stok ekranindaki Toplu fatura dugmesinden acildi */
  bulkEntry?: boolean;
  prefill?: ReceiveStockPrefill | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onDraftChange?: () => void;
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

type LineCostPreview = { lineCost: number; paid: number; debt: number };

/** Fatura odenen tutarina gore kalan borcu kalemlere son satirdan geriye dagitir. */
function applyInvoicePaidOntoLines(
  lines: ReceiveCartLine[],
  invoicePaidTl: string,
  preview: (line: ReceiveCartLine) => LineCostPreview
): ReceiveCartLine[] | null {
  let totalKurus = 0;
  for (const line of lines) {
    totalKurus += preview({ ...line, remainingDebtTl: "" }).lineCost;
  }

  const trimmed = String(invoicePaidTl ?? "").trim();
  if (!trimmed) {
    return lines.map((l) => ({ ...l, remainingDebtTl: "" }));
  }

  const paidParsed = parseTrAmount(trimmed);
  if (paidParsed == null || paidParsed < 0) {
    window.alert("Odenen tutar gecersiz.");
    return null;
  }

  const paidKurus = tlToKurus(paidParsed);
  if (paidKurus > totalKurus) {
    window.alert("Odenen tutar, fatura toplamindan fazla olamaz.");
    return null;
  }

  const debtKurus = totalKurus - paidKurus;
  if (debtKurus <= 0) {
    return lines.map((l) => ({ ...l, remainingDebtTl: "" }));
  }

  let leftKurus = debtKurus;
  const result = lines.map((l) => ({ ...l, remainingDebtTl: "" }));

  for (let i = result.length - 1; i >= 0 && leftKurus > 0; i--) {
    const line = result[i];
    const summary = preview({ ...line, remainingDebtTl: "" });
    const room = summary.lineCost;
    if (room <= 0) continue;
    const assign = Math.min(leftKurus, room);
    result[i] = { ...line, remainingDebtTl: (assign / 100).toFixed(2) };
    leftKurus -= assign;
  }

  if (leftKurus > 0) {
    window.alert("Borc dagitimi hesaplanamadi.");
    return null;
  }
  return result;
}

export function ReceiveStockModal({
  products,
  categories,
  suppliers,
  initialProduct,
  bulkEntry = false,
  prefill,
  onClose,
  onSaved,
  onDraftChange
}: Props) {
  const bulkDraftOnMount = useMemo(() => (bulkEntry ? loadBulkInvoiceDraft() : null), [bulkEntry]);
  const [supplierId, setSupplierId] = useState(bulkDraftOnMount?.supplierId ?? 0);
  const [pickerProductId, setPickerProductId] = useState<number | null>(bulkDraftOnMount?.pickerProductId ?? null);
  const [productSearch, setProductSearch] = useState(bulkDraftOnMount?.productSearch ?? "");
  const [qty, setQty] = useState(1);
  const [incomingCostTl, setIncomingCostTl] = useState("");
  const [costMode, setCostMode] = useState<StockCostMode>("product");
  const [invoicePaidTl, setInvoicePaidTl] = useState("");
  const [remainingDebtTl, setRemainingDebtTl] = useState("");
  const [invoiceTotalPaidTl, setInvoiceTotalPaidTl] = useState(bulkDraftOnMount?.invoicePaidTl ?? "");
  const [cart, setCart] = useState<ReceiveCartLine[]>(bulkDraftOnMount?.cart ?? []);
  const [draftBannerVisible, setDraftBannerVisible] = useState(
    Boolean(bulkDraftOnMount && bulkDraftOnMount.cart.length > 0)
  );
  const [saving, setSaving] = useState(false);
  const pickListRef = useRef<HTMLUListElement>(null);
  const cartRef = useRef(cart);
  const supplierIdRef = useRef(supplierId);
  const invoiceTotalPaidTlRef = useRef(invoiceTotalPaidTl);
  const pickerProductIdRef = useRef(pickerProductId);
  const productSearchRef = useRef(productSearch);
  const submittedRef = useRef(false);

  cartRef.current = cart;
  supplierIdRef.current = supplierId;
  invoiceTotalPaidTlRef.current = invoiceTotalPaidTl;
  pickerProductIdRef.current = pickerProductId;
  productSearchRef.current = productSearch;

  const activeProducts = useMemo(() => products.filter((p) => p.isActive === 1), [products]);
  const cartProductIds = useMemo(() => new Set(cart.map((l) => l.productId)), [cart]);

  const selectedProduct = useMemo(() => {
    if (pickerProductId != null) {
      return activeProducts.find((p) => p.id === pickerProductId) ?? null;
    }
    return initialProduct ?? null;
  }, [pickerProductId, initialProduct, activeProducts]);

  const unit = selectedProduct ? categorySaleUnitOf(categories, selectedProduct.categoryId) : "piece";

  const singleProductMode = !bulkEntry && initialProduct != null;

  const linkedSupplierIdsForProduct = useMemo(() => {
    const p = initialProduct ?? selectedProduct;
    return p ? productSupplierIds(p) : [];
  }, [initialProduct, selectedProduct]);

  const supplierOptions = useMemo(() => {
    if (singleProductMode) {
      return suppliers.filter((s) => linkedSupplierIdsForProduct.includes(s.id));
    }
    return suppliers;
  }, [singleProductMode, suppliers, linkedSupplierIdsForProduct]);

  const supplierProducts = useMemo(() => {
    if (supplierId <= 0) return [];
    const q = productSearch.trim().toLowerCase();
    return activeProducts
      .filter((p) => productHasSupplier(p, supplierId))
      .filter((p) => {
        if (!q) return true;
        const cat = categories.find((c) => c.id === p.categoryId)?.name ?? "";
        return [p.name, p.code, p.barcode, cat].join(" ").toLowerCase().includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [supplierId, activeProducts, productSearch, categories]);

  const showSupplierPicker = !singleProductMode && supplierId > 0 && supplierProducts.length > 0;

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

  const persistBulkDraftIfNeeded = useCallback(() => {
    if (!bulkEntry || submittedRef.current) return;
    const lines = cartRef.current;
    if (lines.length === 0) {
      clearBulkInvoiceDraft();
      onDraftChange?.();
      return;
    }
    saveBulkInvoiceDraft({
      supplierId: supplierIdRef.current,
      cart: lines,
      invoicePaidTl: invoiceTotalPaidTlRef.current,
      pickerProductId: pickerProductIdRef.current,
      productSearch: productSearchRef.current
    });
    onDraftChange?.();
  }, [bulkEntry, onDraftChange]);

  const handleClose = useCallback(() => {
    if (saving) return;
    persistBulkDraftIfNeeded();
    onClose();
  }, [saving, persistBulkDraftIfNeeded, onClose]);

  useEffect(() => {
    if (!bulkEntry || !bulkDraftOnMount?.pickerProductId) return;
    const p = activeProducts.find((x) => x.id === bulkDraftOnMount.pickerProductId);
    if (p) resetFormForProduct(p);
  }, [bulkEntry, bulkDraftOnMount?.pickerProductId, activeProducts, resetFormForProduct]);

  useEffect(() => () => persistBulkDraftIfNeeded(), [persistBulkDraftIfNeeded]);

  useEffect(() => {
    const p = initialProduct ?? null;
    if (!p) return;
    const linked = productSupplierIds(p);
    let sid = 0;
    if (prefill?.supplierId != null && prefill.supplierId > 0 && linked.includes(prefill.supplierId)) {
      sid = prefill.supplierId;
    } else if (linked.length === 1) {
      sid = linked[0];
    } else if (p.supplierId > 0 && linked.includes(p.supplierId)) {
      sid = p.supplierId;
    } else if (linked.length > 0) {
      sid = linked[0];
    }
    setSupplierId(sid);
    resetFormForProduct(p);
    if (prefill?.incomingCostTl) setIncomingCostTl(prefill.incomingCostTl);
    if (prefill?.costMode) setCostMode(prefill.costMode);
    if (prefill?.invoicePaidTl) setInvoicePaidTl(prefill.invoicePaidTl);
    if (prefill?.remainingDebtTl) setRemainingDebtTl(prefill.remainingDebtTl);
  }, [initialProduct?.id, resetFormForProduct, initialProduct, prefill]);

  const onSupplierChange = (sid: number) => {
    setSupplierId(sid);
    setProductSearch("");
    if (sid <= 0) {
      setPickerProductId(initialProduct?.id ?? null);
      return;
    }
    const stillValid =
      pickerProductId != null && activeProducts.some((p) => p.id === pickerProductId && productHasSupplier(p, sid));
    if (!stillValid) {
      const first = activeProducts.find((p) => productHasSupplier(p, sid));
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
    const sid = supplierId > 0 ? supplierId : productSupplierIds(selectedProduct)[0] ?? 0;
    if (!productHasSupplier(selectedProduct, sid)) {
      window.alert("Secilen tedarikci bu urun kartinda tanimli degil.");
      return null;
    }
    const input = buildStockAddInput(selectedProduct, unit, costMode, incomingCostTl, invoicePaidTl, remainingDebtTl, sid);
    if (!input) return null;
    return { raw, input, sid };
  };

  const addToCart = () => {
    if (!selectedProduct) return;
    const savedScroll = pickListRef.current?.scrollTop ?? 0;
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
    setQty(unit === "gram" ? 1000 : 1);
    setRemainingDebtTl("");
    requestAnimationFrame(() => {
      if (pickListRef.current) pickListRef.current.scrollTop = savedScroll;
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const next = prev.filter((l) => l.id !== id);
      if (next.length === 0) {
        setInvoiceTotalPaidTl("");
        if (bulkEntry) {
          clearBulkInvoiceDraft();
          onDraftChange?.();
        }
      }
      return next;
    });
  };

  const clearCartList = () => {
    if (!window.confirm("Listedeki tum kalemler silinsin mi? Kayitli taslak da temizlenir.")) return;
    setCart([]);
    setInvoiceTotalPaidTl("");
    setDraftBannerVisible(false);
    if (bulkEntry) {
      clearBulkInvoiceDraft();
      onDraftChange?.();
    }
  };

  const bumpCartQty = (lineId: string, add: number) => {
    setCart((prev) =>
      prev.map((l) => {
        if (l.id !== lineId || l.saleUnit !== "piece") return l;
        return { ...l, qty: bumpPieceQty(l.qty, add) };
      })
    );
  };

  const bumpFormQty = (add: number) => {
    if (unit !== "piece") return;
    setQty((q) => bumpPieceQty(q, add));
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
      if (bulkEntry) {
        submittedRef.current = true;
        clearBulkInvoiceDraft();
        onDraftChange?.();
      }
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

  const submitCart = async () => {
    if (cart.length === 0) return;
    let linesToSave: ReceiveCartLine[] | null;
    if (invoiceTotalPaidTl.trim()) {
      linesToSave = applyInvoicePaidOntoLines(cart, invoiceTotalPaidTl, previewLine);
    } else if (bulkEntry) {
      linesToSave = cart.map((l) => ({ ...l, remainingDebtTl: "" }));
    } else {
      linesToSave = cart;
    }
    if (!linesToSave) return;
    setSaving(true);
    try {
      const api = getMarinaApi();
      let batchId: string | undefined;
      if (linesToSave.length > 1 && typeof api.nextReceiveBatchId === "function") {
        batchId = await api.nextReceiveBatchId();
      } else if (linesToSave.length > 1) {
        batchId = `SRB-${Date.now()}`;
      }
      await commitLines(linesToSave, batchId);
      if (bulkEntry) {
        submittedRef.current = true;
        clearBulkInvoiceDraft();
        onDraftChange?.();
      }
      await onSaved();
      onClose();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Stok eklenemedi.");
    } finally {
      setSaving(false);
    }
  };

  const invoicePaidKurusForTotals = useMemo(() => {
    const trimmed = invoiceTotalPaidTl.trim();
    if (!trimmed) return null;
    const parsed = parseTrAmount(trimmed);
    if (parsed == null || parsed < 0) return -1;
    return tlToKurus(parsed);
  }, [invoiceTotalPaidTl]);

  const cartTotals = useMemo(() => {
    let total = 0;
    for (const line of cart) {
      total += previewLine({ ...line, remainingDebtTl: "" }).lineCost;
    }
    if (invoicePaidKurusForTotals === null) {
      if (!bulkEntry) {
        let debt = 0;
        for (const line of cart) {
          debt += previewLine(line).debt;
        }
        return { total, debt, paid: total - debt };
      }
      return { total, debt: 0, paid: total };
    }
    if (invoicePaidKurusForTotals < 0) {
      return { total, debt: 0, paid: total };
    }
    const paid = Math.min(invoicePaidKurusForTotals, total);
    return { total, debt: total - paid, paid };
  }, [cart, previewLine, invoicePaidKurusForTotals]);

  const supplierName = suppliers.find((s) => s.id === supplierId)?.name ?? "—";

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!saving) handleClose();
      }}
    >
      <div
        className="modal-dialog stock-receive-dialog stock-receive-dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-receive-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 id="stock-receive-title">{bulkEntry ? "Toplu fatura / gelen stok" : "Gelen / stok ekle"}</h3>
        <p className="stock-help small">
          {bulkEntry
            ? "Once tedarikci secin; o firmaya bagli urunleri listeye ekleyin. Tum kalemler tek fatura (SRB) olarak kaydedilir."
            : "Tedarikci listesi yalnizca urun kartindaki firmalardan gelir. Stok, sectiginiz tedarikci uzerinden kaydedilir."}
        </p>

        {bulkEntry && draftBannerVisible ? (
          <p className="stock-receive-bulk-callout stock-receive-bulk-callout--draft" role="status">
            Yarim kalan liste yuklendi ({cart.length} kalem). Kaldiginiz yerden devam edebilirsiniz.
          </p>
        ) : null}

        {bulkEntry && supplierId <= 0 ? (
          <p className="stock-receive-bulk-callout" role="status">
            Baslamak icin asagidan <strong>tedarikci</strong> secin.
          </p>
        ) : null}

        <label className="stock-receive-qty-label">
          Tedarikci *
          <select value={supplierId} disabled={saving || (singleProductMode && supplierOptions.length <= 1)} onChange={(e) => onSupplierChange(Number(e.target.value))}>
            {singleProductMode && supplierOptions.length === 0 ? (
              <option value={0}>Urun kartina tedarikci ekleyin</option>
            ) : bulkEntry ? (
              <option value={0}>Tedarikci secin</option>
            ) : supplierOptions.length > 1 ? (
              <option value={0}>Tedarikci secin</option>
            ) : null}
            {supplierOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.id === (initialProduct?.supplierId ?? selectedProduct?.supplierId) ? " (birincil)" : ""}
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
              <ul ref={pickListRef} className="stock-receive-product-pick" role="listbox" aria-label="Tedarikci urunleri">
                {supplierProducts.map((p) => {
                  const u = categorySaleUnitOf(categories, p.categoryId);
                  const catName = categories.find((c) => c.id === p.categoryId)?.name ?? "";
                  const inCart = cartProductIds.has(p.id);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={pickerProductId === p.id}
                        className={[pickerProductId === p.id ? "active" : "", inCart ? "is-in-cart" : ""].filter(Boolean).join(" ")}
                        onClick={() => resetFormForProduct(p)}
                        disabled={saving}
                      >
                        <span className="stock-receive-pick-name">
                          {inCart ? (
                            <span className="stock-receive-pick-check" aria-label="Listede" title="Listede">
                              ✓
                            </span>
                          ) : null}
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
                <div className="stock-receive-detail-body">
                  <p className="stock-receive-product-name">{selectedProduct.name}</p>
                  <p className="stock-help small">
                    Mevcut: <strong>{formatQtyShort(selectedProduct.stockQty, unit)}</strong>
                    {selectedProduct.stockQty < 0 ? (
                      <span className="stock-receive-deficit-hint"> — eksik satis; giris once borcu kapatir</span>
                    ) : null}
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
                    showCostPreview={false}
                    hideRemainingDebt={bulkEntry}
                  />
                </div>
                <div className="stock-receive-detail-actions">
                  <button type="button" className="primary stock-receive-add-line-btn" disabled={saving} onClick={addToCart}>
                    Listeye ekle
                  </button>
                </div>
              </div>
            ) : (
              <p className="muted small">Stok eklemek icin urun secin.</p>
            )}
          </div>
        ) : supplierId > 0 ? (
          <p className="muted small">Bu tedarikciye bagli aktif urun yok. Urun kartinda birincil veya ek tedarikci olarak ekleyin.</p>
        ) : null}

        {!showSupplierPicker && selectedProduct ? (
          <>
            <p className="stock-receive-product-name">{selectedProduct.name}</p>
            <p className="stock-help small">
              Mevcut: <strong>{formatQtyShort(selectedProduct.stockQty, unit)}</strong>
              {selectedProduct.stockQty < 0 ? (
                <span className="stock-receive-deficit-hint"> — eksik satis; giris once borcu kapatir</span>
              ) : null}
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
              hideRemainingDebt={bulkEntry}
            />
          </>
        ) : !showSupplierPicker && !selectedProduct && !(bulkEntry && supplierId <= 0) ? (
          <p className="muted small">
            {bulkEntry
              ? "Tedarikci secince urun listesi acilir."
              : "Stok eklemek icin urun secin veya sag tik ile gelen stok acin."}
          </p>
        ) : null}

        {cart.length > 0 ? (
          <section className="stock-receive-cart" aria-label="Gelen stok listesi">
            <div className="stock-receive-cart-head">
              <strong>Liste ({cart.length} kalem)</strong>
            </div>
            <ul className="stock-receive-cart-list">
              {cart.map((line) => {
                const summary = previewLine(line);
                return (
                  <li key={line.id}>
                    <div className="stock-receive-cart-line-row">
                      <div className="stock-receive-cart-line-main">
                        <span>
                          <span className="closure-code">{line.productCode}</span> {line.productName} —{" "}
                          {formatQtyShort(line.qty, line.saleUnit)}
                        </span>
                        <span>{formatTry(summary.lineCost)}</span>
                      </div>
                      {line.saleUnit === "piece" ? (
                        <div className="stock-receive-qty-bump stock-receive-cart-line-bump" aria-label="Listede adet artir">
                          <button type="button" disabled={saving} onClick={() => bumpCartQty(line.id, 5)}>
                            +5
                          </button>
                          <button type="button" className="stock-receive-qty-bump-10" disabled={saving} onClick={() => bumpCartQty(line.id, 10)}>
                            +10
                          </button>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        className="stock-receive-cart-line-remove"
                        disabled={saving}
                        onClick={() => removeFromCart(line.id)}
                        aria-label={`${line.productName} listeden sil`}
                      >
                        Sil
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="stock-receive-cart-totals" aria-label="Fatura toplamlari">
              <label className="stock-receive-invoice-debt-label">
                <span className="stock-incoming-cost-title">Odenen tutar (TL)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={invoiceTotalPaidTl}
                  onChange={(e) => setInvoiceTotalPaidTl(e.target.value)}
                  disabled={saving}
                  placeholder="Bos = tam odendi"
                />
                <span className="stock-help small">
                  Fatura icin odediginiz tutar. Fark ({formatTry(cartTotals.total)} − odenen) tedarikci borcuna yazilir;
                  kayit sirasinda kalemlere dagitilir.
                </span>
              </label>
              <div className="stock-receive-cart-totals-main">
                <span className="stock-receive-cart-totals-label">Fatura toplami</span>
                <strong className="stock-receive-cart-totals-amount">{formatTry(cartTotals.total)}</strong>
              </div>
              {invoiceTotalPaidTl.trim() !== "" || cartTotals.debt > 0 ? (
                <div className="stock-receive-cart-totals-breakdown">
                  <div className="stock-receive-cart-totals-row">
                    <span>Odenen</span>
                    <span>{formatTry(cartTotals.paid)}</span>
                  </div>
                  {cartTotals.debt > 0 ? (
                    <div className="stock-receive-cart-totals-row stock-receive-cart-totals-row--debt">
                      <span>Tedarikci borcu</span>
                      <span>{formatTry(cartTotals.debt)}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <p className="stock-help small">
          Liste bosken tek kalem dogrudan kaydedilir. Birden fazla kalem tek fatura grubu (SRB) olarak tedarikci gecmisinde
          gorunur.
          {bulkEntry
            ? " Eksik odeme varsa fatura altindaki odenen tutari girin; kalan borc tedarikciye yazilir."
            : " Eksik odeme varsa urun satirinda kalan borc veya fatura altindaki odenen tutari kullanabilirsiniz."}
        </p>
        <div className="modal-actions stock-receive-modal-actions">
          {bulkEntry && cart.length > 0 ? (
            <button type="button" className="stock-receive-cart-clear" disabled={saving} onClick={clearCartList}>
              Listeyi temizle
            </button>
          ) : null}
          <div className="stock-receive-modal-actions-end">
            <button type="button" disabled={saving} onClick={handleClose}>
              {bulkEntry && cart.length > 0 ? "Kapat" : "Vazgec"}
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
    </div>
  );
}
