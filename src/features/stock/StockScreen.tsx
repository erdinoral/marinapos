import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { getMarinaApi } from "../../api/marinaClient";
import {
  Category,
  CategorySaleUnit,
  Product,
  Settings,
  StockAddInput,
  StockAgingRow,
  StockCostLayer,
  StockCostMode,
  StockEntryLogRow,
  Supplier
} from "../../types/models";
import {
  categorySaleUnitOf,
  formatQtyShort,
  formatTlPer1000g,
  incomingCostTlToUnitCostKurus,
  inventoryRevenueKurus,
  kurusPerGramToTlPer1000g,
  normalizeGramQty,
  normalizeGramStockQty
} from "../../utils/saleUnit";
import { formatTry, parseTrAmount, tlToKurus } from "../../utils/currency";
import { resolveStockEntryUnitCostKurus, stockCostModeLabel } from "../../utils/stockCost";
import { computeInventoryTotals, lineInventoryCostKurus } from "../../utils/inventoryTotals";
import { StockInventorySummary } from "./StockInventorySummary";
import { suppliersWithDebt, totalSupplierDebtKurus } from "../../utils/supplierDebt";
import { BarcodePrintModal } from "./BarcodePrintModal";
import { StockCostFields } from "./StockCostFields";
import { ReceiveStockModal } from "./ReceiveStockModal";

function netRetailUnitKurus(p: Product): number {
  const d = Math.max(0, Math.min(100, Number(p.discountPercent ?? 0)));
  return Math.round((p.priceKurus * (100 - d)) / 100);
}

function defaultCostTlForProduct(p: Product, unit: CategorySaleUnit): string {
  const cost = p.costPriceKurus ?? 0;
  if (cost <= 0) return "";
  return incomingTlFromUnitCostKurus(cost, unit);
}

function incomingTlFromUnitCostKurus(kurus: number, unit: CategorySaleUnit): string {
  if (kurus <= 0) return "";
  return unit === "gram" ? kurusPerGramToTlPer1000g(kurus).toFixed(2) : (kurus / 100).toFixed(2);
}

function stockEntryUnitCostLabel(entry: StockEntryLogRow, unit: CategorySaleUnit): string {
  const kurus = resolveStockEntryUnitCostKurus(entry, unit);
  if (kurus == null || kurus <= 0) return "—";
  if (unit === "gram") return `${kurusPerGramToTlPer1000g(kurus)} / 1000 g`;
  return `${formatTry(kurus)} / adet`;
}

type StockAddPrefill = {
  incomingCostTl?: string;
  costMode?: StockCostMode;
  supplierId?: number;
  invoicePaidTl?: string;
  remainingDebtTl?: string;
};

interface Props {
  products: Product[];
  lowStock: Product[];
  categories: Category[];
  suppliers: Supplier[];
  lowStockThreshold: number;
  onStockChange: () => Promise<void>;
}

export function StockScreen({ products, lowStock, categories, suppliers, lowStockThreshold, onStockChange }: Props) {
  const [listQuery, setListQuery] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  /** Stok Ekle: bu partinin birim gelisi (TL) */
  const [incomingCostTl, setIncomingCostTl] = useState("");
  const [stockAddCostMode, setStockAddCostMode] = useState<StockCostMode>("product");
  const [stockAddInvoicePaidTl, setStockAddInvoicePaidTl] = useState("");
  const [stockAddRemainingDebtTl, setStockAddRemainingDebtTl] = useState("");
  const [stockAddSupplierId, setStockAddSupplierId] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<number>(0);
  const [agingRows, setAgingRows] = useState<StockAgingRow[]>([]);
  const [entryLog, setEntryLog] = useState<StockEntryLogRow[]>([]);
  const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null);
  const [costLayers, setCostLayers] = useState<StockCostLayer[]>([]);
  const [barcodePrintOpen, setBarcodePrintOpen] = useState(false);
  const [printSettings, setPrintSettings] = useState<Settings | null>(null);
  /** Stok / eksik liste: sag tik menusu */
  const [stockRowContext, setStockRowContext] = useState<{ x: number; y: number; product: Product } | null>(null);
  /** Eksik listeden acilan gelen / stok ekle modal */
  const [receiveStockProduct, setReceiveStockProduct] = useState<Product | null>(null);
  /** Stok listesinden acilan sayim / stok duzelt modal */
  const [listAdjustProduct, setListAdjustProduct] = useState<Product | null>(null);
  const [listAdjustCounted, setListAdjustCounted] = useState("");
  const [listAdjustNote, setListAdjustNote] = useState("");
  const [listAdjustSaving, setListAdjustSaving] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const stockAddSectionRef = useRef<HTMLElement>(null);
  const stockLayoutRef = useRef<HTMLDivElement>(null);

  const clearStockSelection = useCallback(() => {
    setSelectedId(null);
    setQuery("");
    setQty(1);
    setIncomingCostTl("");
    setStockAddSupplierId(0);
    setStockRowContext(null);
  }, []);
  const selectedProduct = useMemo(() => products.find((p) => p.id === selectedId) ?? null, [products, selectedId]);
  const selectedUnit = selectedProduct ? categorySaleUnitOf(categories, selectedProduct.categoryId) : "piece";
  const listAdjustUnit = listAdjustProduct ? categorySaleUnitOf(categories, listAdjustProduct.categoryId) : "piece";

  const filterProducts = useCallback(
    (q: string) => {
      const needle = q.trim().toLowerCase();
      return products.filter((p) => {
        const textMatch =
          needle === "" ||
          p.name.toLowerCase().includes(needle) ||
          p.code.toLowerCase().includes(needle) ||
          p.barcode.toLowerCase().includes(needle);
        const categoryMatch = categoryFilter === 0 || p.categoryId === categoryFilter;
        return textMatch && categoryMatch;
      });
    },
    [products, categoryFilter]
  );

  const listFiltered = useMemo(() => filterProducts(listQuery), [filterProducts, listQuery]);
  const filtered = useMemo(() => filterProducts(query), [filterProducts, query]);

  /** Eksik liste + Stok Ekle panelinde urunu sec; ilgili satirlara kaydir */
  const selectForStockAdd = useCallback(
    (product: Product, prefill?: StockAddPrefill) => {
      const unit = categorySaleUnitOf(categories, product.categoryId);
      setSelectedId(product.id);
      setQuery(product.name.trim() || product.code.trim() || product.barcode.trim());
      setQty(unit === "gram" ? 1000 : 1);
      setStockAddSupplierId(
        prefill?.supplierId != null && prefill.supplierId > 0
          ? prefill.supplierId
          : product.supplierId > 0
            ? product.supplierId
            : 0
      );
      setIncomingCostTl(prefill?.incomingCostTl ?? defaultCostTlForProduct(product, unit));
      setStockAddCostMode(prefill?.costMode ?? "product");
      setStockAddInvoicePaidTl(prefill?.invoicePaidTl ?? "");
      setStockAddRemainingDebtTl(prefill?.remainingDebtTl ?? "");
      setStockRowContext(null);
      requestAnimationFrame(() => {
        document.getElementById(`stock-low-row-${product.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        stockAddSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        document.getElementById(`stock-add-option-${product.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    },
    [categories]
  );

  const applyEntryLogToStockAdd = useCallback(
    (row: StockEntryLogRow) => {
      const p = products.find((x) => x.id === row.productId);
      if (!p) {
        window.alert("Urun bulunamadi.");
        return;
      }
      const unit = row.saleUnit ?? categorySaleUnitOf(categories, p.categoryId);
      const unitKurus = resolveStockEntryUnitCostKurus(row, unit);
      const prefill: StockAddPrefill = {
        costMode: row.costMode ?? "product",
        supplierId: row.supplierId,
        invoicePaidTl:
          row.invoicePaidKurus != null && row.invoicePaidKurus > 0 ? (row.invoicePaidKurus / 100).toFixed(2) : "",
        remainingDebtTl:
          row.debtAddedKurus != null && row.debtAddedKurus > 0 ? (row.debtAddedKurus / 100).toFixed(2) : ""
      };
      if (unitKurus != null && unitKurus > 0) {
        prefill.incomingCostTl = incomingTlFromUnitCostKurus(unitKurus, unit);
      }
      selectForStockAdd(p, prefill);
    },
    [categories, products, selectForStockAdd]
  );

  const openStockRowContextMenu = (e: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number }, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    const pad = 8;
    const menuW = 220;
    const menuH = 88;
    const x = Math.max(pad, Math.min(e.clientX, window.innerWidth - menuW - pad));
    const y = Math.max(pad, Math.min(e.clientY, window.innerHeight - menuH - pad));
    setStockRowContext({ x, y, product });
  };

  const openReceiveStockModal = (product: Product) => {
    selectForStockAdd(product);
    setReceiveStockProduct(product);
    setStockRowContext(null);
  };

  const supplierDebtTotalKurus = useMemo(() => totalSupplierDebtKurus(suppliers), [suppliers]);
  const suppliersInDebt = useMemo(() => suppliersWithDebt(suppliers), [suppliers]);

  const applyRemainingDebtToInput = (input: StockAddInput, remainingDebtTl: string): boolean => {
    const trimmed = String(remainingDebtTl ?? "").trim();
    if (trimmed === "") return true;
    const d = parseTrAmount(trimmed);
    if (d == null || d < 0) {
      window.alert("Kalan borc (TL) gecersiz.");
      return false;
    }
    if (d === 0) return true;
    input.remainingDebtKurus = tlToKurus(d);
    return true;
  };

  const buildStockAddInput = (
    product: Product,
    unit: CategorySaleUnit,
    costMode: StockCostMode,
    costTl: string,
    invoicePaidTl: string,
    remainingDebtTl: string,
    supplierId: number
  ): StockAddInput | null => {
    if (supplierId <= 0) {
      window.alert("Tedarikci secin. Gelis kaydi ilgili tedarikci gecmisine yazilir.");
      return null;
    }
    const input: StockAddInput = { supplierId, costMode, recordExpense: true };

    if (costMode === "invoice") {
      const paid = parseTrAmount(String(invoicePaidTl ?? "").trim());
      if (paid == null || paid <= 0) {
        window.alert("Odenen fatura tutari (TL) girin.");
        return null;
      }
      input.invoicePaidKurus = tlToKurus(paid);
      const trimmed = String(costTl ?? "").trim();
      if (trimmed !== "") {
        const parsed = incomingCostTlToUnitCostKurus(costTl, unit);
        if (parsed === null) {
          window.alert("Referans birim gelis (TL) gecersiz.");
          return null;
        }
        if (parsed !== undefined) input.unitCostKurus = parsed;
      }
      if (!applyRemainingDebtToInput(input, remainingDebtTl)) return null;
      return input;
    }

    const trimmed = String(costTl ?? "").trim();
    if (trimmed !== "") {
      const parsed = incomingCostTlToUnitCostKurus(costTl, unit);
      if (parsed === null) {
        window.alert("Birim gelis (TL) gecersiz.");
        return null;
      }
      if (parsed === undefined) {
        window.alert("Birim gelis (TL) girin.");
        return null;
      }
      input.unitCostKurus = parsed;
    } else if ((product.costPriceKurus ?? 0) <= 0) {
      window.alert("Birim gelis (TL) girin veya urun kartinda maliyet tanimlayin.");
      return null;
    }
    if (!applyRemainingDebtToInput(input, remainingDebtTl)) return null;
    return input;
  };

  const submitStockAdd = async (
    product: Product,
    quantity: number,
    unit: CategorySaleUnit,
    costMode: StockCostMode,
    costTl: string,
    invoicePaidTl: string,
    remainingDebtTl: string,
    supplierId: number
  ) => {
    const input = buildStockAddInput(product, unit, costMode, costTl, invoicePaidTl, remainingDebtTl, supplierId);
    if (!input) return false;
    await getMarinaApi().addStock(product.id, quantity, input);
    return true;
  };

  const addStock = async () => {
    if (!selectedProduct || !selectedId || qty <= 0) return;
    const q = selectedUnit === "gram" ? normalizeGramQty(qty) : qty;
    if (selectedUnit === "gram" && !Number.isInteger(q)) {
      window.alert("Gram miktar tam sayi olmalidir.");
      return;
    }
    try {
      const ok = await submitStockAdd(
        selectedProduct,
        q,
        selectedUnit,
        stockAddCostMode,
        incomingCostTl,
        stockAddInvoicePaidTl,
        stockAddRemainingDebtTl,
        stockAddSupplierId
      );
      if (!ok) return;
      setIncomingCostTl(defaultCostTlForProduct(selectedProduct, selectedUnit));
      await onStockChange();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Stok eklenemedi.");
    }
  };

  const openListAdjustModal = (p: Product) => {
    const unit = categorySaleUnitOf(categories, p.categoryId);
    setListAdjustProduct(p);
    setListAdjustCounted(unit === "gram" ? String(normalizeGramStockQty(p.stockQty)) : String(Math.round(p.stockQty)));
    setListAdjustNote("");
    setSelectedId(p.id);
    setStockRowContext(null);
  };

  const submitListAdjust = async () => {
    if (!listAdjustProduct) return;
    const counted = Math.round(Number(String(listAdjustCounted).replace(",", ".")));
    if (!Number.isFinite(counted) || counted < 0) {
      window.alert("Stok miktari gecersiz.");
      return;
    }
    if (listAdjustUnit === "piece" && !Number.isInteger(counted)) {
      window.alert("Adetli urunlerde stok tam sayi olmalidir.");
      return;
    }
    if (listAdjustUnit === "gram" && !Number.isInteger(counted)) {
      window.alert("Gram stok tam sayi olmalidir.");
      return;
    }
    setListAdjustSaving(true);
    try {
      await getMarinaApi().adjustStock(listAdjustProduct.id, counted, listAdjustNote.trim());
      setListAdjustProduct(null);
      setListAdjustCounted("");
      setListAdjustNote("");
      await onStockChange();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Stok guncellenemedi.");
    } finally {
      setListAdjustSaving(false);
    }
  };

  const deleteSelectedProduct = async () => {
    if (!selectedId) return;
    const p = products.find((x) => x.id === selectedId);
    if (!p) return;
    if (!window.confirm(`"${p.name}" urunu silinsin mi? (Kayit kalir, listede gorunmez.)`)) return;
    try {
      await getMarinaApi().deleteProduct(selectedId);
      setSelectedId(null);
      await onStockChange();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Silinemedi.");
    }
  };

  useEffect(() => {
    const api = getMarinaApi();
    try {
      if (typeof api.getStockAging === "function") {
        void api.getStockAging().then(setAgingRows).catch(() => setAgingRows([]));
      } else {
        setAgingRows([]);
      }
    } catch {
      setAgingRows([]);
    }
    try {
      if (typeof api.getStockEntryLog === "function") {
        void api.getStockEntryLog().then(setEntryLog).catch(() => setEntryLog([]));
      } else {
        setEntryLog([]);
      }
    } catch {
      setEntryLog([]);
    }
    try {
      if (typeof api.listStockCostLayers === "function") {
        void api.listStockCostLayers().then(setCostLayers).catch(() => setCostLayers([]));
      } else {
        setCostLayers([]);
      }
    } catch {
      setCostLayers([]);
    }
    void getMarinaApi()
      .getSettings()
      .then(setPrintSettings)
      .catch(() => setPrintSettings(null));
  }, [products]);

  useEffect(() => {
    if (selectedId == null) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (
        t.closest(
          ".stock-row-main, .stock-row.danger, .stock-entry-row--clickable, .stock-add-panel, .stock-context-menu, .modal-backdrop, .modal-dialog, .stock-clear-selection-btn"
        )
      ) {
        return;
      }
      clearStockSelection();
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [selectedId, clearStockSelection]);

  useEffect(() => {
    if (!stockRowContext) return;
    const close = () => setStockRowContext(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [stockRowContext]);

  useEffect(() => {
    if (!selectedProduct) {
      setStockAddSupplierId(0);
      setIncomingCostTl("");
      return;
    }
    setStockAddSupplierId(selectedProduct.supplierId > 0 ? selectedProduct.supplierId : 0);
    setIncomingCostTl(defaultCostTlForProduct(selectedProduct, selectedUnit));
  }, [selectedId, selectedProduct, selectedUnit]);

  useEffect(() => {
    if (!listAdjustProduct) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !listAdjustSaving) setListAdjustProduct(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listAdjustProduct, listAdjustSaving]);

  useEffect(() => {
    if (!detailProduct) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetailProduct(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailProduct]);

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
  };

  const stockLabelForProduct = (p: Product) => formatQtyShort(p.stockQty, categorySaleUnitOf(categories, p.categoryId));
  const supplierNameById = useMemo(() => new Map(suppliers.map((s) => [s.id, s.name])), [suppliers]);
  const supplierLabel = (p: Product) => supplierNameById.get(p.supplierId) ?? "-";

  const printLowStockList = () => {
    const rows = lowStock
      .map((p) => {
        const unit = categorySaleUnitOf(categories, p.categoryId);
        return `<tr><td>${p.name}</td><td>${p.code}</td><td style="text-align:right">${formatQtyShort(p.stockQty, unit)}</td></tr>`;
      })
      .join("");
    const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"/><title>Eksik Stok Listesi</title>
<style>
body{font-family:Arial,sans-serif;padding:20px;color:#111} h1{margin:0 0 6px} p{margin:0 0 14px;color:#555}
table{width:100%;border-collapse:collapse} th,td{border:1px solid #999;padding:8px;font-size:12px;text-align:left}
</style></head><body>
<h1>Eksik Stok Listesi</h1>
<p>Esik: adetli urunlerde ${lowStockThreshold} adet, gramajli urunlerde 1000 g alti.</p>
<table><thead><tr><th>Urun</th><th>Kod</th><th>Stok</th></tr></thead><tbody>
${rows || `<tr><td colspan="3">Eksik urun yok</td></tr>`}
</tbody></table>
</body></html>`;
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);
    const doc = frame.contentWindow?.document;
    if (!doc || !frame.contentWindow) {
      frame.remove();
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    const doPrint = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      window.setTimeout(() => frame.remove(), 1200);
    };
    frame.onload = doPrint;
    window.setTimeout(doPrint, 250);
  };

  /** Liste en yeni ustte; urun basina ilk gorulen = o urunun son girisi */
  const latestMovementIdByProduct = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of entryLog) {
      if (!map.has(row.productId)) map.set(row.productId, row.movementId);
    }
    return map;
  }, [entryLog]);

  const refreshEntryLog = useCallback(async () => {
    const api = getMarinaApi();
    try {
      if (typeof api.getStockEntryLog === "function") {
        const rows = await api.getStockEntryLog();
        setEntryLog(Array.isArray(rows) ? rows : []);
      }
    } catch {
      setEntryLog([]);
    }
  }, []);

  const deleteStockEntry = async (row: StockEntryLogRow) => {
    if (latestMovementIdByProduct.get(row.productId) !== row.movementId) {
      window.alert("Yalnizca her urunun en son stok girisi silinebilir. Once daha yeni girisi silin.");
      return;
    }
    const label = `${row.productName} (+${formatQtyShort(row.qty, row.saleUnit ?? "piece")})`;
    if (
      !window.confirm(
        `${label} kaydi silinsin mi?\n\nStok miktarindan dusulur, ilgili mal alimi gideri ve varsa tedarikci borcu geri alinir.`
      )
    ) {
      return;
    }
    setDeletingEntryId(row.movementId);
    try {
      await getMarinaApi().deleteStockEntry(row.movementId);
      await onStockChange();
      await refreshEntryLog();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Stok girisi silinemedi.");
    } finally {
      setDeletingEntryId(null);
    }
  };

  const listTotals = useMemo(
    () => computeInventoryTotals(listFiltered, categories, costLayers),
    [listFiltered, categories, costLayers]
  );

  return (
    <div className="stock-layout" ref={stockLayoutRef}>
      <section className="stock-panel-list stock-grid-list">
        <div className="stock-panel-list-top">
          <h2>Stok Listesi</h2>
          <p className="stock-help small">
            Kategori eklemek icin <strong>Urun Ekle</strong> sekmesindeki sag sutunu kullanin.
          </p>
          <p className="stock-help small">
            Satira <strong>sol tik</strong>: urun <strong>Eksik liste</strong> ve <strong>Stok Ekle</strong> bolumlerinde secilir;
            <strong>sag tik</strong>: gelen / stok ekle veya sayim duzeltme. <strong>Detay</strong>: maliyet ve satis tahmini.
          </p>
          <label className="search-wrap stock-list-search">
            <span className="search-icon">⌕</span>
            <input
              className="search"
              type="search"
              placeholder="Ad, kod veya barkod ile ara"
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const barcode = listQuery.trim();
                if (barcode.length < 4) return;
                e.preventDefault();
                const found = listFiltered.find((p) => p.barcode === barcode);
                if (found) selectForStockAdd(found);
              }}
            />
          </label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(Number(e.target.value))}>
            <option value={0}>Tum kategoriler</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="stock-scroll-body stock-scroll-body--list">
          <div className="stock-list-rows">
            {listFiltered.map((p) => (
              <motion.div
                key={p.id}
                role="button"
                tabIndex={0}
                className={`stock-row-main ${selectedId === p.id ? "stock-row-selected" : ""}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                title="Sol tik: urunu sec — Sag tik: gelen / stok ekle veya sayim duzelt"
                onClick={() => selectForStockAdd(p)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectForStockAdd(p);
                  }
                }}
                onContextMenu={(e) => openStockRowContextMenu(e, p)}
              >
                <span className="stock-row-main-text">
                  {p.name}
                  <small className="product-card-meta">Tedarikci: {supplierLabel(p)}</small>
                </span>
                <span className="stock-row-main-qty">{stockLabelForProduct(p)}</span>
                <button
                  type="button"
                  className="stock-detail-btn"
                  title="Stok ve maliyet detayi"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(p.id);
                    setDetailProduct(p);
                  }}
                  onContextMenu={(e) => e.stopPropagation()}
                >
                  Detay
                </button>
              </motion.div>
            ))}
          </div>
        </div>
        {listFiltered.length > 15 ? (
          <p className="stock-list-scroll-hint">Liste en fazla 15 satir gosterir; tum urunler icin asagiya kaydirin.</p>
        ) : null}
        {listFiltered.length > 0 ? (
          <StockInventorySummary totals={listTotals} />
        ) : (
          <p className="stock-help small stock-list-empty-hint">Filtreye uyan urun yok.</p>
        )}
      </section>
      <section className="stock-panel-list stock-grid-eksik">
        <div className="stock-panel-list-top">
          <h2>Eksik liste</h2>
          <p className="stock-help small">
            Esik: <strong>{lowStockThreshold}</strong> adet (adetli kategoriler) / <strong>1000</strong> g (gramajli
            kategoriler). <strong>Sol tik</strong>: sagdaki <strong>Stok Ekle</strong> panelinde urunu secer.
          </p>
          <div className="stock-panel-list-actions">
            <button type="button" className="stock-barcode-btn" onClick={printLowStockList}>
              Eksik Listeyi Yazdir
            </button>
            {selectedProduct ? (
              <button type="button" className="stock-clear-selection-btn" onClick={clearStockSelection}>
                Secimi kaldir
              </button>
            ) : (
              <span className="stock-panel-list-actions-spacer" aria-hidden="true" />
            )}
          </div>
        </div>
        <div className="stock-scroll-body stock-scroll-body--list">
          {lowStock.map((p) => (
            <motion.div
              key={p.id}
              id={`stock-low-row-${p.id}`}
              role="button"
              tabIndex={0}
              className={`stock-row danger${selectedId === p.id ? " stock-row-picked" : ""}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              title="Sol tik: Stok Ekle panelinde sec — tekrar tik: secimi kaldir — Sag tik: gelen / stok ekle veya sayim duzelt"
              onClick={() => {
                if (selectedId === p.id) clearStockSelection();
                else selectForStockAdd(p);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (selectedId === p.id) clearStockSelection();
                  else selectForStockAdd(p);
                }
              }}
              onContextMenu={(e) => openStockRowContextMenu(e, p)}
            >
              <span>{p.name}</span>
              <span>{stockLabelForProduct(p)}</span>
            </motion.div>
          ))}
          {lowStock.length === 0 && <p className="stock-help small">Eksik urun yok.</p>}
        </div>
      </section>
      <section className="stock-panel-list stock-panel-aging stock-grid-aging">
        <div className="stock-panel-list-top stock-panel-list-top--compact">
          <h2>Stokta kalma / satis suresi</h2>
        </div>
        <div className="stock-scroll-body stock-scroll-body--list stock-scroll-body--aging">
          <div className="stock-aging-wrap">
            <div className="stock-aging-header">
              <span>Urun</span>
              <span>Stok</span>
              <span>Satilan</span>
              <span>Ort. satis suresi</span>
              <span>Mevcut stok yasi</span>
            </div>
            {agingRows.map((row) => {
              const p = products.find((x) => x.id === row.productId);
              const unit = p ? categorySaleUnitOf(categories, p.categoryId) : "piece";
              return (
                <motion.div key={row.productId} className="stock-aging-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <span title={row.productName}>{row.productName}</span>
                  <span>{formatQtyShort(row.stockQty, unit)}</span>
                  <span>{formatQtyShort(row.soldQty, unit)}</span>
                  <span>{row.avgDaysToSell == null ? "-" : `${row.avgDaysToSell.toFixed(1)} gun`}</span>
                  <span>{row.currentStockAgeDays == null ? "-" : `${row.currentStockAgeDays.toFixed(1)} gun`}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
      <section className="stock-panel-list stock-panel-entry-log stock-grid-history">
        <div className="stock-panel-list-top stock-panel-list-top--compact">
          <h2>Stok ekleme gecmisi</h2>
          <p className="stock-help small">
            En yeni kayitlar ustte. <strong>Satira tik</strong>: urun ve <strong>birim gelis</strong> sagdaki Stok Ekle alanina aktarilir.
            Sil: stok, mal alimi gideri ve tedarikci borcunu geri alir (urunun en son girisi).
          </p>
        </div>
        <div className="stock-scroll-body stock-scroll-body--list">
          <div className="stock-aging-wrap stock-entry-log-wrap">
            <div className="stock-entry-header stock-entry-header--cost">
              <span>Tarih/Saat</span>
              <span>Urun</span>
              <span>Kod</span>
              <span>Tedarikci</span>
              <span>Miktar</span>
              <span>Birim gelis</span>
              <span>Toplam</span>
              <span>Not</span>
              <span className="stock-entry-col-actions" aria-hidden="true" />
            </div>
            {entryLog.map((row) => {
              const p = products.find((x) => x.id === row.productId);
              const unit = row.saleUnit ?? (p ? categorySaleUnitOf(categories, p.categoryId) : "piece");
              const canDelete = latestMovementIdByProduct.get(row.productId) === row.movementId;
              const deleting = deletingEntryId === row.movementId;
              return (
                <motion.div
                  key={row.movementId}
                  role="button"
                  tabIndex={0}
                  className={`stock-entry-row stock-entry-row--cost stock-entry-row--clickable${selectedId === row.productId ? " stock-entry-row--picked" : ""}`}
                  title="Tikla: Stok Ekle panelinde urun ve birim gelis"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => applyEntryLogToStockAdd(row)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      applyEntryLogToStockAdd(row);
                    }
                  }}
                >
                  <span>{formatDateTime(row.createdAt)}</span>
                  <span title={row.productName}>{row.productName}</span>
                  <span>{row.productCode || "—"}</span>
                  <span title={row.supplierName}>{row.supplierName || "—"}</span>
                  <span>+{formatQtyShort(row.qty, unit)}</span>
                  <span>{stockEntryUnitCostLabel(row, unit)}</span>
                  <span>
                    {row.lineCostKurus != null && row.lineCostKurus > 0 ? formatTry(row.lineCostKurus) : "—"}
                    {row.costMode === "invoice" &&
                    row.catalogLineCostKurus != null &&
                    row.catalogLineCostKurus > 0 &&
                    row.catalogLineCostKurus !== row.lineCostKurus ? (
                      <span className="stock-entry-catalog-hint" title="Liste / birim hesabi">
                        {" "}
                        (liste {formatTry(row.catalogLineCostKurus)})
                      </span>
                    ) : null}
                  </span>
                  <span title={row.note}>
                    {row.costMode ? `[${stockCostModeLabel(row.costMode)}] ` : ""}
                    {(row.debtAddedKurus ?? 0) > 0 ? (
                      <span className="supplier-debt-badge supplier-debt-badge-inline" title="Bu girisle eklenen tedarikci borcu">
                        +borc {formatTry(row.debtAddedKurus!)}
                      </span>
                    ) : null}{" "}
                    {row.note || "-"}
                  </span>
                  <span className="stock-entry-col-actions">
                    <button
                      type="button"
                      className="stock-entry-delete-btn"
                      disabled={!canDelete || deletingEntryId != null}
                      title={
                        canDelete
                          ? "Bu girisi sil (stok, gider ve borc geri alinir)"
                          : "Once bu urunun daha yeni stok girisini silin"
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteStockEntry(row);
                      }}
                    >
                      {deleting ? "…" : "Sil"}
                    </button>
                  </span>
                </motion.div>
              );
            })}
            {entryLog.length === 0 && (
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
            )}
          </div>
        </div>
      </section>
      <section ref={stockAddSectionRef} className="stock-add-panel stock-grid-add" aria-label="Stok ekle">
        <h2>Stok Ekle</h2>
        {selectedProduct ? (
          <div className="stock-add-selected-row">
            <p className="stock-add-selected-hint">
              Secili: <strong>{selectedProduct.name}</strong> — {stockLabelForProduct(selectedProduct)}
            </p>
            <button type="button" className="stock-clear-selection-btn" onClick={clearStockSelection}>
              Secimi kaldir
            </button>
          </div>
        ) : (
          <p className="stock-help small">Listeden veya eksik listeden bir urun secin.</p>
        )}
        <input placeholder="Ad, kod, barkod ara" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="search-results">
          {filtered.map((p) => (
            <motion.button
              whileHover={{ scale: 1.01 }}
              key={p.id}
              id={`stock-add-option-${p.id}`}
              onClick={() => selectForStockAdd(p)}
              className={selectedId === p.id ? "selected" : ""}
            >
              {p.name} ({p.code}/{p.barcode}) — {stockLabelForProduct(p)} — Tedarikci: {supplierLabel(p)}
            </motion.button>
          ))}
        </div>
        <button type="button" className="stock-barcode-btn" disabled={!selectedProduct} onClick={() => setBarcodePrintOpen(true)}>
          Barkod yazdir
        </button>
        <button type="button" className="stock-delete-btn" disabled={!selectedProduct} onClick={() => void deleteSelectedProduct()}>
          Urunu sil
        </button>
        <input
          type="number"
          min={selectedUnit === "gram" ? 1 : 1}
          step="1"
          value={qty}
          onChange={(e) => {
            const n = Number(e.target.value);
            setQty(selectedUnit === "gram" ? Math.max(1, Math.round(n || 0)) : n);
          }}
        />
        {supplierDebtTotalKurus > 0 ? (
          <p className="stock-supplier-debt-banner" role="status">
            Tedarikci borcu toplam: <strong>{formatTry(supplierDebtTotalKurus)}</strong>
            {suppliersInDebt.length > 0 ? (
              <>
                {" "}
                —{" "}
                {suppliersInDebt.map((s) => (
                  <span key={s.id}>
                    {s.name}{" "}
                    <span className="supplier-debt-badge supplier-debt-badge-inline">{formatTry(s.balanceOwedKurus)}</span>
                    {" · "}
                  </span>
                ))}
              </>
            ) : null}
          </p>
        ) : null}
        <label className="stock-incoming-cost-label">
          <span className="stock-incoming-cost-title">Tedarikci *</span>
          <select
            value={stockAddSupplierId}
            disabled={!selectedProduct}
            onChange={(e) => setStockAddSupplierId(Number(e.target.value))}
          >
            <option value={0}>Tedarikci secin</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.balanceOwedKurus > 0 ? ` — borc ${formatTry(s.balanceOwedKurus)}` : ""}
              </option>
            ))}
          </select>
          <span className="stock-help small">Gelis kaydi secilen tedarikcinin gecmisine yazilir; urun karti da guncellenir.</span>
        </label>
        <StockCostFields
          saleUnit={selectedUnit}
          qty={qty}
          costMode={stockAddCostMode}
          onCostModeChange={setStockAddCostMode}
          incomingCostTl={incomingCostTl}
          onIncomingCostTlChange={setIncomingCostTl}
          invoicePaidTl={stockAddInvoicePaidTl}
          onInvoicePaidTlChange={setStockAddInvoicePaidTl}
          remainingDebtTl={stockAddRemainingDebtTl}
          onRemainingDebtTlChange={setStockAddRemainingDebtTl}
          disabled={!selectedProduct}
          product={selectedProduct}
        />
        <p className="stock-help small">
          Gider, Rapor → Gelir/Gider ekraninda &quot;Mal alimi / stok&quot; olarak kaydedilir. Satista maliyet: once eski
          parti (or. 20 ₺), o bitince yeni parti (or. 50 ₺); ayni fiyatla gelen miktar son partiye eklenir.
        </p>
        <button onClick={() => void addStock()}>{selectedUnit === "gram" ? "Gram Ekle" : "Adet Ekle"}</button>
      </section>
      <BarcodePrintModal
        product={selectedProduct}
        categorySaleUnit={selectedProduct ? categorySaleUnitOf(categories, selectedProduct.categoryId) : "piece"}
        settings={printSettings}
        open={barcodePrintOpen && Boolean(selectedProduct)}
        onClose={() => setBarcodePrintOpen(false)}
        onSaved={onStockChange}
      />
      {stockRowContext ? (
        <ul
          className="stock-context-menu"
          style={{ left: stockRowContext.x, top: stockRowContext.y }}
          role="menu"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                openReceiveStockModal(stockRowContext.product);
              }}
            >
              Gelen / stok ekle
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                openListAdjustModal(stockRowContext.product);
              }}
            >
              Sayim / stok duzelt
            </button>
          </li>
        </ul>
      ) : null}
      {receiveStockProduct ? (
        <ReceiveStockModal
          products={products}
          categories={categories}
          suppliers={suppliers}
          initialProduct={receiveStockProduct}
          onClose={() => setReceiveStockProduct(null)}
          onSaved={onStockChange}
        />
      ) : null}
      {detailProduct ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setDetailProduct(null)}
        >
          <div
            className="modal-dialog stock-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stock-detail-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="stock-detail-title">Stok detayi</h3>
            {(() => {
              const live = products.find((x) => x.id === detailProduct.id) ?? detailProduct;
              const unit = categorySaleUnitOf(categories, live.categoryId);
              const unitLabel = unit === "gram" ? "gram" : "adet";
              const costUnit = live.costPriceKurus ?? 0;
              const invCost = lineInventoryCostKurus(live, unit, costLayers);
              const netSell = netRetailUnitKurus(live);
              const revenue = inventoryRevenueKurus(live, unit);
              const profit = revenue - invCost;
              const disc = live.discountPercent ?? 0;
              return (
                <>
                  <p className="stock-receive-product-name">{live.name}</p>
                  <p className="stock-help small">
                    Kod: {live.code} — Barkod: {live.barcode || "-"} — Tedarikci: {supplierLabel(live)}
                  </p>
                  <dl className="stock-detail-dl">
                    <div>
                      <dt>Mevcut stok</dt>
                      <dd>{stockLabelForProduct(live)}</dd>
                    </div>
                    <div>
                      <dt>{unit === "gram" ? "Aktif gelis (FIFO, 1000 g)" : "Aktif gelis (FIFO, sonraki satis)"}</dt>
                      <dd>
                        {unit === "gram" ? formatTlPer1000g(costUnit) : `${formatTry(costUnit)} / ${unitLabel}`}
                      </dd>
                    </div>
                    <div>
                      <dt>Eldeki stogun maliyet degeri</dt>
                      <dd>{formatTry(invCost)}</dd>
                    </div>
                    <div>
                      <dt>{unit === "gram" ? "Liste satis (1000 g, indirim oncesi)" : "Liste satis (birim, indirim oncesi)"}</dt>
                      <dd>
                        {unit === "gram" ? formatTlPer1000g(live.priceKurus) : `${formatTry(live.priceKurus)} / ${unitLabel}`}
                      </dd>
                    </div>
                    {disc > 0 ? (
                      <div>
                        <dt>Urun karti indirimi</dt>
                        <dd>%{disc}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>{unit === "gram" ? "Net satis (1000 g, liste + urun indirimi)" : "Net satis birimi (liste + urun indirimi)"}</dt>
                      <dd>
                        {unit === "gram" ? formatTlPer1000g(netSell) : `${formatTry(netSell)} / ${unitLabel}`}
                      </dd>
                    </div>
                    <div>
                      <dt>Stok satilirsa tahmini ciro</dt>
                      <dd>{formatTry(revenue)}</dd>
                    </div>
                    <div className="stock-detail-dl-highlight">
                      <dt>Tahmini brut kar (bu stok)</dt>
                      <dd>{formatTry(profit)}</dd>
                    </div>
                  </dl>
                  <p className="stock-help small">
                    POS&apos;ta musteri / satir indirimi veya kart fiyati seciliyse gercek satis farkli olabilir.
                  </p>
                  <div className="modal-actions">
                    <button type="button" className="primary" onClick={() => setDetailProduct(null)}>
                      Tamam
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}
      {listAdjustProduct ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => {
            if (!listAdjustSaving) setListAdjustProduct(null);
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
            {(() => {
              const live = products.find((x) => x.id === listAdjustProduct.id) ?? listAdjustProduct;
              return (
                <>
                  <p className="stock-receive-product-name">{live.name}</p>
                  <p className="stock-help small">
                    Kayitli stok: <strong>{stockLabelForProduct(live)}</strong> — Kod: {live.code} — Tedarikci: {supplierLabel(live)}
                  </p>
                </>
              );
            })()}
            <label className="stock-receive-qty-label">
              {listAdjustUnit === "gram" ? "Gercek stok (gram)" : "Gercek stok (adet)"}
              <input
                type="number"
                min={0}
                step="1"
                value={listAdjustCounted}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    setListAdjustCounted("");
                    return;
                  }
                  setListAdjustCounted(
                    listAdjustUnit === "gram" ? String(Math.max(0, Math.round(Number(v) || 0))) : v
                  );
                }}
                disabled={listAdjustSaving}
                autoFocus
              />
            </label>
            <label className="stock-receive-qty-label">
              Not (istege bagli)
              <input
                type="text"
                value={listAdjustNote}
                onChange={(e) => setListAdjustNote(e.target.value)}
                disabled={listAdjustSaving}
                placeholder="Orn. sayim, fire"
              />
            </label>
            <div className="modal-actions">
              <button type="button" disabled={listAdjustSaving} onClick={() => setListAdjustProduct(null)}>
                Vazgec
              </button>
              <button type="button" className="primary" disabled={listAdjustSaving} onClick={() => void submitListAdjust()}>
                {listAdjustSaving ? "Kaydediliyor..." : "Stogu guncelle"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
