import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getMarinaApi } from "../../api/marinaClient";
import {
  Category,
  CategorySaleUnit,
  Customer,
  CustomerInput,
  CustomerKind,
  CustomerStats,
  InvoiceCustomerInfo,
  PaymentType,
  Product,
  Supplier,
  SaleKind,
  SaleRecord,
  SaleWithLines,
  TopSellingProduct
} from "../../types/models";
import { formatTry, formatTlTable, formatTlWhole, parseTrAmount, parseTrAmountWhole, parseTlDecimal, tlToKurus } from "../../utils/currency";
import { invoiceInfoFromCustomer } from "../../utils/invoiceFromCustomer";
import { saleCollectedKurus, saleKindListLabel } from "../../utils/saleCollected";
import {
  categorySaleUnitOf,
  defaultGramQtyForCart,
  formatLowStockRemainLabel,
  formatQtyShort,
  gramsFromLineTotalTl,
  gramPriceKurusMigrate,
  isProductLowStock,
  kurusPerGramToTlPer1000g,
  normalizeGramQty,
  tlPer1000gToKurusPerGram,
  wholesalePricePlaceholder
} from "../../utils/saleUnit";
import {
  CartPriceSource,
  effectiveTlPer1000gForLine,
  effectiveUnitKurusForLine,
  formatPosUnitPrice,
  lineToSaleInput,
  lineTotalKurusForCart,
  lineTotalTlForCart,
  newLineFromProduct,
  PosCartLine
} from "./posCartLine";
import { customerAddKindLabel } from "../../utils/customerLabels";
import {
  type ContactFormShape,
  renderSupplierLikeForm
} from "../customers/customerContactForm";
import {
  cashChangeAfterDebtPaymentKurus,
  customerBalanceAfterSaleKurus,
  debtReductionFromSurplusKurus,
  salePaymentSurplusKurus
} from "../../utils/customerDebtPayment";
import { PosCartCustomerSelect } from "./PosCartCustomerSelect";
import { CustomersPanel } from "../customers/CustomersPanel";
import { ReceiveStockModal } from "../stock/ReceiveStockModal";
import { StockAdjustModal } from "../stock/StockAdjustModal";

interface Props {
  products: Product[];
  categories: Category[];
  suppliers: Supplier[];
  lowStockThreshold: number;
  onSaleCompleted: () => Promise<void>;
  onDataRefresh?: () => void | Promise<void>;
}

function saleUnitFor(categories: Category[], product: Pick<Product, "categoryId">) {
  return categorySaleUnitOf(categories, product.categoryId);
}

function qtyExceedsStock(qty: number, stockQty: number, unit: CategorySaleUnit): boolean {
  if (unit === "gram") return normalizeGramQty(qty) > Math.max(0, Math.round(stockQty));
  return qty > stockQty + 1e-9;
}

function confirmNegativeStockSale(
  lines: Array<{ name: string; qty: number; stockQty: number; unit: CategorySaleUnit }>
): boolean {
  if (lines.length === 0) return true;
  const body = lines
    .map((l) => {
      const after = l.stockQty - l.qty;
      return `• ${l.name}: stok ${formatQtyShort(l.stockQty, l.unit)}, satis ${formatQtyShort(l.qty, l.unit)} (kalan ${formatQtyShort(after, l.unit)})`;
    })
    .join("\n");
  return window.confirm(
    `Asagidaki urunler stoktan fazla satilacak ve eksiye dusecek:\n\n${body}\n\nStok girildiginde bakiye otomatik duzelir.\n\nOnayliyor musunuz?`
  );
}

function resolveImageSrc(imagePath: string) {
  const raw = String(imagePath ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:") || raw.startsWith("file://")) {
    return raw;
  }
  const normalized = raw.replace(/\\/g, "/");
  try {
    if (/^[a-zA-Z]:\//.test(normalized)) {
      return new URL(`file:///${normalized}`).toString();
    }
    if (normalized.startsWith("//")) {
      return new URL(`file:${normalized}`).toString();
    }
    if (normalized.startsWith("/")) {
      return new URL(`file://${normalized}`).toString();
    }
  } catch {
    return encodeURI(`file:///${normalized}`);
  }
  return raw;
}

function formatSaleTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(11, 16);
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function maskCiroAmount(reveal: boolean, formatted: string) {
  return reveal ? formatted : "***";
}

type PosCatalogUnitFilter = "all" | CategorySaleUnit;

function saleMatchesCatalogFilter(
  saleId: number,
  productIdsBySale: Record<number, number[]>,
  products: Product[],
  categories: Category[],
  unitFilter: PosCatalogUnitFilter,
  categoryId: number
): boolean {
  if (unitFilter === "all" && categoryId === 0) return true;
  const lineProductIds = productIdsBySale[saleId] ?? [];
  return lineProductIds.some((pid) => {
    const p = products.find((x) => x.id === pid);
    if (!p) return false;
    const cat = categories.find((c) => c.id === p.categoryId);
    const unit: CategorySaleUnit = cat?.saleUnit === "gram" ? "gram" : "piece";
    if (unitFilter !== "all" && unit !== unitFilter) return false;
    if (categoryId !== 0 && p.categoryId !== categoryId) return false;
    return true;
  });
}

/** Gram satir: satilan miktar (tam sayi g) */
function CartGramQtyField({ qty, onCommit }: { qty: number; onCommit: (grams: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const committed = String(Math.max(1, Math.round(qty)));
  const value = draft !== null ? draft : committed;

  return (
    <label className="cart-field">
      <span className="cart-field-label">Satilan (g)</span>
      <input
        type="text"
        inputMode="numeric"
        className="cart-field-input"
        placeholder="1000"
        aria-label="Satilan gram (tam sayi)"
        value={value}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={() => {
          if (draft !== null) {
            const n = Number(draft);
            if (Number.isFinite(n) && n > 0) onCommit(n);
          }
          setDraft(null);
        }}
        onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}

/** Gram satir: sepette birim fiyat TL / 1000 g — perakende salt okunur; toptanda duzenlenebilir */
function CartGramUnitPriceField({
  manualUnitPriceKurus,
  autoTlPer1000gPlaceholder,
  label,
  readOnly,
  onCommit,
  onClear
}: {
  manualUnitPriceKurus: number | null;
  autoTlPer1000gPlaceholder: number;
  label: string;
  readOnly?: boolean;
  onCommit: (tlStr: string) => void;
  onClear?: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const effectiveTl =
    manualUnitPriceKurus != null ? kurusPerGramToTlPer1000g(manualUnitPriceKurus) : autoTlPer1000gPlaceholder;
  const committed = manualUnitPriceKurus != null ? kurusPerGramToTlPer1000g(manualUnitPriceKurus).toFixed(2) : "";
  const value = draft !== null ? draft : committed;
  const ph = autoTlPer1000gPlaceholder > 0 ? autoTlPer1000gPlaceholder.toFixed(2) : "";

  if (readOnly) {
    return (
      <div className="cart-field cart-field-unit cart-field-unit--readonly">
        <span className="cart-field-label">{label}</span>
        <span className="cart-field-readonly" title="Liste / musteri birim fiyati">
          {effectiveTl > 0 ? formatTlTable(effectiveTl).replace(" ₺", "") : "—"} / 1000 g
        </span>
        {manualUnitPriceKurus != null && onClear ? (
          <button type="button" className="cart-unit-clear-btn" onClick={onClear} title="Ozel birimi kaldir, liste fiyatina don">
            Liste fiyati
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <label className="cart-field cart-field-unit">
      <span className="cart-field-label">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        className="cart-field-input"
        placeholder={ph}
        aria-label={label}
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== null) onCommit(draft);
          setDraft(null);
        }}
        onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}

/** Adet satir: sepette birim fiyat TL / adet */
function CartUnitPriceField({
  manualUnitPriceKurus,
  autoUnitKurusPlaceholder,
  onCommit
}: {
  manualUnitPriceKurus: number | null;
  autoUnitKurusPlaceholder: number;
  onCommit: (tlStr: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const committed = manualUnitPriceKurus != null ? (manualUnitPriceKurus / 100).toFixed(2) : "";
  const value = draft !== null ? draft : committed;
  const ph = (autoUnitKurusPlaceholder / 100).toFixed(2);

  return (
    <label className="cart-field cart-field-unit">
      <span className="cart-field-label">Birim TL</span>
      <input
        type="text"
        inputMode="decimal"
        className="cart-field-input"
        placeholder={ph}
        aria-label="Sepet satiri birim fiyat (TL), bos birakinca liste fiyati"
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== null) onCommit(draft);
          setDraft(null);
        }}
        onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}

/** Gram satir: tutar girilince gram hesaplanir; gram girilince tutar gosterilir */
function CartGramSaleTlField({
  lineTotalTl,
  onCommit
}: {
  lineTotalTl: number;
  onCommit: (tlStr: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const committed = lineTotalTl > 0 ? formatTlWhole(lineTotalTl) : "";
  const value = draft !== null ? draft : committed;

  return (
    <label className="cart-field">
      <span className="cart-field-label">Tutar (TL)</span>
      <input
        type="text"
        inputMode="numeric"
        className="cart-field-input"
        placeholder="0"
        aria-label="Satilan tutar TL (tam sayi); birim fiyata gore gram hesaplanir"
        value={value}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={() => {
          if (draft !== null) onCommit(draft);
          setDraft(null);
        }}
        onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}

type PosPane = "main" | "today" | "ledger";

type PosCartBucket = { id: number; name: string; items: PosCartLine[]; cardSpecialTl: string };

/** Kapatma / satis sonrasi: id 1..n ve adlar Sepet 1, Sepet 2 … */
function normalizeCartBuckets(
  buckets: PosCartBucket[],
  activeCartId: number
): { carts: PosCartBucket[]; activeId: number } {
  if (buckets.length === 0) {
    return { carts: [{ id: 1, name: "Sepet 1", items: [], cardSpecialTl: "" }], activeId: 1 };
  }
  const activeIndex = buckets.findIndex((c) => c.id === activeCartId);
  const idx = activeIndex >= 0 ? activeIndex : 0;
  const carts = buckets.map((c, i) => ({
    ...c,
    id: i + 1,
    name: `Sepet ${i + 1}`
  }));
  return { carts, activeId: idx + 1 };
}

type EditProductForm = {
  name: string;
  description: string;
  barcode: string;
  code: string;
  categoryId: number;
  supplierId: number;
  priceTl: string;
  wholesaleTl: string;
  sellsWholesale: boolean;
  alternateTl: string;
  posFavorite: boolean;
  discountPercent: string;
  costTl: string;
  stockQty: string;
  material: string;
  vatRatePercent: string;
  priceIncludesVat: boolean;
  domesticMade: boolean;
  imagePath: string;
};

export function PosScreen({ products, categories, suppliers, lowStockThreshold, onSaleCompleted, onDataRefresh }: Props) {
  const [posPane, setPosPane] = useState<PosPane>("main");
  const [today, setToday] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const [topSellersOpen, setTopSellersOpen] = useState(false);
  /** Once adet / gramajli; sonra kategori chip */
  const [posSaleUnitFilter, setPosSaleUnitFilter] = useState<PosCatalogUnitFilter>("all");
  const [posCategoryFilter, setPosCategoryFilter] = useState(0);
  const [customerSearch, setCustomerSearch] = useState("");
  const [addCustomerKind, setAddCustomerKind] = useState<CustomerKind>("wholesale");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedPosCustomerId, setSelectedPosCustomerId] = useState<number | null>(null);
  const [customerCustomPricesByProduct, setCustomerCustomPricesByProduct] = useState<Record<number, number>>({});
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null);
  const [customerRecentSales, setCustomerRecentSales] = useState<SaleWithLines[]>([]);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [addCustomerForm, setAddCustomerForm] = useState({
    name: "",
    phone: "",
    email: "",
    companyName: "",
    address: "",
    district: "",
    city: "",
    taxOrVkn: "",
    note: "",
    balanceTl: "",
    discountPct: ""
  });
  const [customerDetailCustomer, setCustomerDetailCustomer] = useState<Customer | null>(null);
  const [customerDetailForm, setCustomerDetailForm] = useState({
    name: "",
    phone: "",
    email: "",
    companyName: "",
    address: "",
    district: "",
    city: "",
    taxOrVkn: "",
    note: "",
    balanceTl: "",
    discountPct: ""
  });
  const [customerDetailSaving, setCustomerDetailSaving] = useState(false);
  const [customerDetailSales, setCustomerDetailSales] = useState<SaleWithLines[]>([]);
  const [customerDetailSalesLoading, setCustomerDetailSalesLoading] = useState(false);
  const [saleKind, setSaleKind] = useState<SaleKind>("sale");
  /** Sepette seciliyken urun listesinden eklenen satirlar bu kaynakla acilir (toptan = wholesalePriceKurus). */
  const [cartPriceMode, setCartPriceMode] = useState<"retail" | "wholesale">("retail");
  const cartAddPriceSource = useMemo<CartPriceSource>(
    () => (cartPriceMode === "wholesale" ? "wholesale" : "retail"),
    [cartPriceMode]
  );
  const [carts, setCarts] = useState<PosCartBucket[]>([{ id: 1, name: "Sepet 1", items: [], cardSpecialTl: "" }]);
  const [activeCartId, setActiveCartId] = useState(1);
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [paidAmountTl, setPaidAmountTl] = useState("");
  const [dailySales, setDailySales] = useState<SaleRecord[]>([]);
  const [dailySaleProductIds, setDailySaleProductIds] = useState<Record<number, number[]>>({});
  /** Bugunun satislari sekmesi: liste filtre / siralama */
  const [todayListKind, setTodayListKind] = useState<"all" | SaleKind>("all");
  const [todayListPayment, setTodayListPayment] = useState<"all" | PaymentType>("all");
  /** Bos: tumu; "none": musterisiz; sayi stringi: musteri id */
  const [todayListCustomerKey, setTodayListCustomerKey] = useState<string>("");
  const [todayListSaleUnitFilter, setTodayListSaleUnitFilter] = useState<PosCatalogUnitFilter>("all");
  const [todayListCategoryId, setTodayListCategoryId] = useState(0);
  const [todayListQuery, setTodayListQuery] = useState("");
  const [todayListSort, setTodayListSort] = useState<"time_desc" | "time_asc" | "amount_desc" | "amount_asc">("time_desc");
  const [topSelling, setTopSelling] = useState<TopSellingProduct[]>([]);
  const [ciroHover, setCiroHover] = useState(false);
  const [ciroPinned, setCiroPinned] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<EditProductForm | null>(null);
  /** Satis urun karti: sag tik menusu */
  const [productContext, setProductContext] = useState<{ x: number; y: number; product: Product } | null>(null);
  const [posReceiveProduct, setPosReceiveProduct] = useState<Product | null>(null);
  const [posAdjustProduct, setPosAdjustProduct] = useState<Product | null>(null);
  const [imageSrcMap, setImageSrcMap] = useState<Record<string, string>>({});
  const [imageLoadErrors, setImageLoadErrors] = useState<Record<string, boolean>>({});
  const [mediaDir, setMediaDir] = useState("");
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);
  const [invoicePreviewHtml, setInvoicePreviewHtml] = useState("");
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState<SaleWithLines | null>(null);
  const [invoiceCustomer, setInvoiceCustomer] = useState<InvoiceCustomerInfo>({
    fullName: "",
    companyName: "",
    tcOrVkn: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    district: ""
  });
  const invoiceFrameRef = useRef<HTMLIFrameElement | null>(null);

  const loadDailySales = useCallback(async () => {
    try {
      const api = getMarinaApi();
      const [rows, productIds] = await Promise.all([
        api.getDailySales(today),
        typeof api.getDailySaleProductIds === "function"
          ? api.getDailySaleProductIds(today)
          : Promise.resolve({} as Record<number, number[]>)
      ]);
      setDailySales(rows);
      setDailySaleProductIds(productIds);
    } catch {
      setDailySales([]);
      setDailySaleProductIds({});
    }
  }, [today]);

  useEffect(() => {
    void loadDailySales();
  }, [loadDailySales]);

  useEffect(() => {
    if (posPane === "today") void loadDailySales();
  }, [posPane, loadDailySales]);

  useEffect(() => {
    setTodayListKind("all");
    setTodayListPayment("all");
    setTodayListCustomerKey("");
    setTodayListSaleUnitFilter("all");
    setTodayListCategoryId(0);
    setTodayListQuery("");
    setTodayListSort("time_desc");
  }, [today]);

  useEffect(() => {
    if (posCategoryFilter === 0) return;
    const cat = categories.find((c) => c.id === posCategoryFilter);
    if (!cat || (posSaleUnitFilter !== "all" && cat.saleUnit !== posSaleUnitFilter)) setPosCategoryFilter(0);
  }, [posSaleUnitFilter, posCategoryFilter, categories]);

  useEffect(() => {
    if (todayListCategoryId === 0) return;
    const cat = categories.find((c) => c.id === todayListCategoryId);
    if (!cat || (todayListSaleUnitFilter !== "all" && cat.saleUnit !== todayListSaleUnitFilter)) {
      setTodayListCategoryId(0);
    }
  }, [todayListSaleUnitFilter, todayListCategoryId, categories]);

  useEffect(() => {
    const loadTop = async () => {
      try {
        const rows = await getMarinaApi().getTopSellingProducts(10);
        setTopSelling(rows);
      } catch {
        setTopSelling([]);
      }
    };
    void loadTop();
  }, [products.length]);

  useEffect(() => {
    const api = getMarinaApi();
    if (typeof api.getMediaDirectory !== "function") return;
    void api.getMediaDirectory().then((dir) => setMediaDir(String(dir ?? ""))).catch(() => setMediaDir(""));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const nowDate = new Date().toISOString().slice(0, 10);
      setToday((prev) => {
        if (prev === nowDate) return prev;
        setCarts([{ id: 1, name: "Sepet 1", items: [], cardSpecialTl: "" }]);
        setActiveCartId(1);
        setSearch("");
        setCustomerSearch("");
        setSelectedPosCustomerId(null);
        setPaidAmountTl("");
        setSaleKind("sale");
        return nowDate;
      });
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const activeCart = useMemo(() => carts.find((c) => c.id === activeCartId) ?? carts[0], [activeCartId, carts]);
  const cart = activeCart?.items ?? [];

  const salesSummary = useMemo(() => {
    let grossKurus = 0;
    let cashKurus = 0;
    let cardKurus = 0;
    for (const r of dailySales) {
      const collected = saleCollectedKurus(r);
      grossKurus += collected;
      if (r.paymentType === "cash") cashKurus += collected;
      else cardKurus += collected;
    }
    return { count: dailySales.length, grossKurus, cashKurus, cardKurus };
  }, [dailySales]);

  const todaySaleCustomerIds = useMemo(() => {
    const s = new Set<number>();
    for (const r of dailySales) {
      const cid = r.customerId;
      if (cid != null && cid > 0) s.add(cid);
    }
    return Array.from(s).sort((a, b) => a - b);
  }, [dailySales]);

  const filteredDailySales = useMemo(() => {
    const qRaw = todayListQuery.trim().toLowerCase();
    const qn = qRaw.replace(/^#/, "").replace(/\s+/g, "");
    const rows = dailySales.filter((sale) => {
      if (todayListKind !== "all" && sale.kind !== todayListKind) return false;
      if (todayListPayment !== "all" && sale.paymentType !== todayListPayment) return false;
      if (todayListCustomerKey === "none") {
        const cid = sale.customerId;
        if (cid != null && cid > 0) return false;
      } else if (todayListCustomerKey !== "") {
        const want = Number(todayListCustomerKey);
        if (!Number.isFinite(want) || sale.customerId !== want) return false;
      }
      if (qRaw) {
        const idStr = String(sale.id);
        const cart = (sale.cartName || "").toLowerCase();
        const matchesId = qn !== "" && idStr.includes(qn);
        const matchesCart = cart.includes(qRaw);
        if (!matchesId && !matchesCart) return false;
      }
      if (
        sale.kind !== "debt_payment" &&
        !saleMatchesCatalogFilter(
          sale.id,
          dailySaleProductIds,
          products,
          categories,
          todayListSaleUnitFilter,
          todayListCategoryId
        )
      ) {
        return false;
      }
      return true;
    });
    const cmp = (a: SaleRecord, b: SaleRecord) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      switch (todayListSort) {
        case "time_desc":
          return tb - ta;
        case "time_asc":
          return ta - tb;
        case "amount_desc":
          return saleCollectedKurus(b) - saleCollectedKurus(a);
        case "amount_asc":
          return saleCollectedKurus(a) - saleCollectedKurus(b);
        default:
          return tb - ta;
      }
    };
    return rows.slice().sort(cmp);
  }, [
    dailySales,
    dailySaleProductIds,
    products,
    todayListKind,
    todayListPayment,
    todayListCustomerKey,
    categories,
    todayListSaleUnitFilter,
    todayListCategoryId,
    todayListQuery,
    todayListSort
  ]);

  const posCategoriesForUnit = useMemo(() => {
    return categories
      .filter((c) => posSaleUnitFilter !== "all" && c.saleUnit === posSaleUnitFilter)
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [categories, posSaleUnitFilter]);

  const todayCategoriesForUnit = useMemo(() => {
    return categories
      .filter((c) => todayListSaleUnitFilter !== "all" && c.saleUnit === todayListSaleUnitFilter)
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [categories, todayListSaleUnitFilter]);

  const showCiroAmounts = ciroHover || ciroPinned;

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (p.isActive !== 1) return false;
      const unit = saleUnitFor(categories, p);
      if (posSaleUnitFilter !== "all" && unit !== posSaleUnitFilter) return false;
      if (posCategoryFilter !== 0 && p.categoryId !== posCategoryFilter) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q);
    });
  }, [products, search, categories, posSaleUnitFilter, posCategoryFilter]);

  useEffect(() => {
    const candidates = Array.from(
      new Set(
        products
          .map((p) => String(p.imagePath ?? "").trim())
          .filter((p) => p && !p.startsWith("http://") && !p.startsWith("https://") && !p.startsWith("data:"))
      )
    ).filter((p) => !imageSrcMap[p]);
    if (candidates.length === 0) return;
    let cancelled = false;
    const api = getMarinaApi();
    if (typeof api.readImageAsDataUrl !== "function") return;
    void Promise.all(candidates.map(async (p) => ({ path: p, src: await api.readImageAsDataUrl(p) }))).then((rows) => {
      if (cancelled) return;
      setImageSrcMap((prev) => {
        const next = { ...prev };
        for (const row of rows) {
          if (row.src) next[row.path] = row.src;
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [products, imageSrcMap]);

  useEffect(() => {
    const p = editForm?.imagePath?.trim();
    if (!p || imageSrcMap[p]) return;
    if (p.startsWith("http://") || p.startsWith("https://") || p.startsWith("data:")) return;
    const api = getMarinaApi();
    if (typeof api.readImageAsDataUrl !== "function") return;
    let cancelled = false;
    void api.readImageAsDataUrl(p).then((src) => {
      if (cancelled || !src) return;
      setImageSrcMap((prev) => ({ ...prev, [p]: src }));
    });
    return () => {
      cancelled = true;
    };
  }, [editForm?.imagePath, imageSrcMap]);

  const favoriteSaleProducts = useMemo(
    () =>
      products.filter((p) => {
        if (p.isActive !== 1 || p.posFavorite !== 1) return false;
        const unit = saleUnitFor(categories, p);
        return true;
      }),
    [products, categories]
  );

  const refreshCustomers = useCallback(async () => {
    try {
      const rows = await getMarinaApi().listCustomers();
      setCustomers(rows);
    } catch {
      setCustomers([]);
    }
  }, []);

  const deleteCustomerById = useCallback(
    async (c: Customer) => {
      const label =
        c.kind === "wholesale" && c.companyName.trim() ? `${c.companyName.trim()} · ${c.name}` : c.name;
      if (!window.confirm(`"${label}" musterisi silinsin mi?\n\nGecmis satislardaki musteri baglantisi kaldirilir; satis kayitlari silinmez.`)) {
        return;
      }
      try {
        await getMarinaApi().deleteCustomer(c.id);
        if (selectedPosCustomerId === c.id) setSelectedPosCustomerId(null);
        if (customerDetailCustomer?.id === c.id) setCustomerDetailCustomer(null);
        await refreshCustomers();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Musteri silinemedi.");
      }
    },
    [refreshCustomers, selectedPosCustomerId, customerDetailCustomer?.id]
  );

  useEffect(() => {
    void refreshCustomers();
  }, [refreshCustomers]);

  useEffect(() => {
    if (posPane === "ledger") void refreshCustomers();
  }, [posPane, refreshCustomers]);

  useEffect(() => {
    if (!selectedPosCustomerId) {
      setCustomerStats(null);
      setCustomerRecentSales([]);
      return;
    }
    const api = getMarinaApi();
    let cancelled = false;
    void Promise.all([api.getCustomerStats(selectedPosCustomerId), api.getSalesForCustomer(selectedPosCustomerId, 14)]).then(
      ([st, sales]) => {
        if (cancelled) return;
        setCustomerStats(st);
        setCustomerRecentSales(Array.isArray(sales) ? sales : []);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [selectedPosCustomerId]);

  const filteredWholesaleCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    return customers
      .filter((c) => c.kind === "wholesale")
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.companyName.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q) ||
          c.note.toLowerCase().includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [customers, customerSearch]);

  const filteredRetailCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    return customers
      .filter((c) => c.kind === "retail_regular")
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.companyName.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q) ||
          c.note.toLowerCase().includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [customers, customerSearch]);

  const selectedPosCustomer = useMemo(
    () => (selectedPosCustomerId != null ? customers.find((c) => c.id === selectedPosCustomerId) ?? null : null),
    [customers, selectedPosCustomerId]
  );

  /** Musteri kartindaki yuzde; sepet birim fiyatina ek indirim olarak uygulanir */
  const customerLineDiscPct = useMemo(
    () => Math.max(0, Math.min(100, Number(selectedPosCustomer?.suggestedDiscountPercent ?? 0))),
    [selectedPosCustomer?.id, selectedPosCustomer?.suggestedDiscountPercent]
  );

  const customersSortedForSelect = useMemo(
    () => [...customers].sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [customers]
  );

  const renderCustomerListRow = useCallback(
    (c: Customer) => (
      <div key={c.id} className="customer-list-row-wrap">
        <button
          type="button"
          title="Sol tik: sec / tekrar tikla secimi kaldir — Sag tik: detay / fatura bilgileri"
          className={`customer-list-row-main${selectedPosCustomerId === c.id ? " is-selected" : ""}`}
          onClick={() => {
            setSelectedPosCustomerId((prev) => (prev === c.id ? null : c.id));
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setCustomerDetailCustomer(c);
          }}
        >
          <span className="customer-list-name">
            {c.kind === "wholesale" && c.companyName.trim() ? `${c.companyName.trim()} · ` : null}
            {c.name}
          </span>
          {c.phone.trim() ? <span className="customer-list-phone">{c.phone}</span> : null}
          {c.email.trim() ? <span className="customer-list-email">{c.email}</span> : null}
          {c.balanceOwedKurus > 0 ? (
            <span className="customer-list-balance">Borc: {formatTry(c.balanceOwedKurus)}</span>
          ) : (
            <span className="customer-list-balance muted">Borc yok</span>
          )}
        </button>
        <button
          type="button"
          className="customer-list-delete-btn"
          title="Musteriyi sil"
          aria-label={`Sil: ${c.name}`}
          onClick={(e) => {
            e.stopPropagation();
            void deleteCustomerById(c);
          }}
        >
          Sil
        </button>
      </div>
    ),
    [deleteCustomerById, selectedPosCustomerId]
  );

  useEffect(() => {
    if (!selectedPosCustomerId) return;
    const c = customers.find((x) => x.id === selectedPosCustomerId);
    if (c) setInvoiceCustomer(invoiceInfoFromCustomer(c));
  }, [selectedPosCustomerId, customers]);

  useEffect(() => {
    if (!productContext) return;
    const close = () => setProductContext(null);
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest(".stock-context-menu")) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [productContext]);

  useEffect(() => {
    if (!customerDetailCustomer) return;
    const c = customerDetailCustomer;
    setCustomerDetailForm({
      name: c.name,
      phone: c.phone,
      email: c.email,
      companyName: c.companyName,
      address: c.address,
      district: c.district,
      city: c.city,
      taxOrVkn: c.taxOrVkn,
      note: c.note,
      balanceTl: c.balanceOwedKurus > 0 ? (c.balanceOwedKurus / 100).toFixed(2) : "",
      discountPct: c.suggestedDiscountPercent > 0 ? String(c.suggestedDiscountPercent) : ""
    });
  }, [customerDetailCustomer]);

  useEffect(() => {
    if (!customerDetailCustomer) {
      setCustomerDetailSales([]);
      return;
    }
    let cancelled = false;
    setCustomerDetailSalesLoading(true);
    void getMarinaApi()
      .getSalesForCustomer(customerDetailCustomer.id, 60)
      .then((rows) => {
        if (!cancelled) setCustomerDetailSales(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setCustomerDetailSales([]);
      })
      .finally(() => {
        if (!cancelled) setCustomerDetailSalesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerDetailCustomer?.id]);

  useEffect(() => {
    if (!customerDetailCustomer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !customerDetailSaving) setCustomerDetailCustomer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [customerDetailCustomer, customerDetailSaving]);

  const quickSaleProducts = useMemo(() => {
    const productById = new Map(products.map((p) => [p.id, p]));
    return topSelling
      .map((t) => ({ ...t, product: productById.get(t.productId) }))
      .filter((x) => {
        if (!x.product || x.product.isActive !== 1) return false;
        const unit = saleUnitFor(categories, x.product);
        return true;
      })
      .slice(0, 8) as Array<TopSellingProduct & { product: Product }>;
  }, [products, topSelling, categories]);

  /** Satista odeme Kart seciliyken urun kartindaki kart fiyati (alternatePriceKurus) taban olur */
  const applyCardListPrice = useMemo(() => saleKind === "sale" && paymentType === "card", [saleKind, paymentType]);

  const linesTotalKurus = useMemo(
    () => cart.reduce((sum, item) => sum + lineTotalKurusForCart(item, categories, customerLineDiscPct, applyCardListPrice), 0),
    [cart, categories, customerLineDiscPct, applyCardListPrice]
  );

  const clearPosCustomerSelection = useCallback(() => {
    setSelectedPosCustomerId(null);
    setCustomerStats(null);
    setCustomerRecentSales([]);
  }, []);

  const resetPosSaleDefaults = useCallback(() => {
    clearPosCustomerSelection();
    setSaleKind("sale");
    setCartPriceMode("retail");
    setPaymentType("cash");
    setPaidAmountTl("");
    setSearch("");
    setPosSaleUnitFilter("all");
    setPosCategoryFilter(0);
  }, [clearPosCustomerSelection]);
  const cardExtraKurus = useMemo(() => {
    const raw = Number(String(activeCart?.cardSpecialTl ?? "").replace(",", "."));
    return saleKind === "sale" && paymentType === "card" && Number.isFinite(raw) && raw > 0 ? tlToKurus(raw) : 0;
  }, [activeCart?.cardSpecialTl, saleKind, paymentType]);
  const totalKurus = linesTotalKurus + cardExtraKurus;
  const paidAmountKurus = useMemo(() => {
    if (saleKind !== "sale" || (paymentType !== "cash" && paymentType !== "card")) return totalKurus;
    const raw = paidAmountTl.trim();
    if (!raw) return totalKurus;
    const n = Number(String(raw).replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? tlToKurus(n) : totalKurus;
  }, [paidAmountTl, paymentType, saleKind, totalKurus]);

  const saleShortfallKurus = useMemo(() => {
    if (saleKind !== "sale" || (paymentType !== "cash" && paymentType !== "card")) return 0;
    if (!paidAmountTl.trim()) return 0;
    return Math.max(0, totalKurus - paidAmountKurus);
  }, [saleKind, paymentType, paidAmountTl, totalKurus, paidAmountKurus]);

  const saleSurplusKurus = useMemo(() => {
    if (saleKind !== "sale" || (paymentType !== "cash" && paymentType !== "card")) return 0;
    if (!paidAmountTl.trim()) return 0;
    return salePaymentSurplusKurus(paidAmountKurus, totalKurus);
  }, [saleKind, paymentType, paidAmountTl, paidAmountKurus, totalKurus]);

  const saleDebtPaymentKurus = useMemo(() => {
    if (!selectedPosCustomer || saleSurplusKurus <= 0) return 0;
    return debtReductionFromSurplusKurus(saleSurplusKurus, selectedPosCustomer.balanceOwedKurus);
  }, [selectedPosCustomer, saleSurplusKurus]);

  const customerDebtAfterSaleKurus = useMemo(() => {
    if (!selectedPosCustomer) return 0;
    return customerBalanceAfterSaleKurus(
      selectedPosCustomer.balanceOwedKurus,
      saleShortfallKurus,
      saleSurplusKurus
    );
  }, [selectedPosCustomer, saleShortfallKurus, saleSurplusKurus]);

  const changeKurus =
    paymentType === "cash" && saleKind === "sale" && paidAmountTl.trim() && selectedPosCustomer
      ? cashChangeAfterDebtPaymentKurus(saleSurplusKurus, selectedPosCustomer.balanceOwedKurus)
      : paymentType === "cash" && saleKind === "sale" && paidAmountTl.trim()
        ? Math.max(0, paidAmountKurus - totalKurus)
        : 0;

  const addToCart = useCallback(
    (product: Product, priceSource: CartPriceSource = "retail") => {
      const unit = saleUnitFor(categories, product);
      setCarts((prev) => {
        return prev.map((cartRow) => {
          if (cartRow.id !== activeCartId) return cartRow;
          const existing = cartRow.items.find((x) => x.id === product.id && x.priceSource === priceSource);
          if (!existing) {
            const qty = unit === "gram" ? defaultGramQtyForCart(product.stockQty) : 1;
            const line = newLineFromProduct(product, qty, priceSource);
            if (priceSource !== "wholesale") {
              const customKurus = customerCustomPricesByProduct[product.id];
              if (customKurus != null && customKurus > 0) {
                line.manualUnitPriceKurus =
                  unit === "gram" ? gramPriceKurusMigrate(customKurus) : customKurus;
              }
            }
            return { ...cartRow, items: [...cartRow.items, line] };
          }
          if (unit === "gram") {
            return cartRow;
          }
          const qty = Math.floor(existing.qty + 1);
          return {
            ...cartRow,
            items: cartRow.items.map((x) => (x.id === product.id && x.priceSource === priceSource ? { ...x, qty } : x))
          };
        });
      });
    },
    [activeCartId, categories, customerCustomPricesByProduct]
  );

  const changeQty = (productId: number, priceSource: CartPriceSource, delta: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product || saleUnitFor(categories, product) === "gram") return;
    setCarts((prev) =>
      prev.map((cartRow) =>
        cartRow.id !== activeCartId
          ? cartRow
          : {
              ...cartRow,
              items: cartRow.items
                .map((item) => {
                  if (item.id !== productId || item.priceSource !== priceSource) return item;
                  const next = Math.floor(item.qty + delta);
                  return { ...item, qty: Math.max(0, next) };
                })
                .filter((item) => item.qty > 0)
            }
      )
    );
  };

  const setPieceQtyFromInput = (productId: number, priceSource: CartPriceSource, value: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product || saleUnitFor(categories, product) === "gram") return;
    if (!Number.isFinite(value)) return;
    const next = Math.max(1, Math.floor(value));
    setCarts((prev) =>
      prev.map((cartRow) =>
        cartRow.id !== activeCartId
          ? cartRow
          : {
              ...cartRow,
              items: cartRow.items
                .map((item) => (item.id === productId && item.priceSource === priceSource ? { ...item, qty: next } : item))
                .filter((item) => item.qty > 0)
            }
      )
    );
  };

  const removeFromCart = (productId: number, priceSource: CartPriceSource) => {
    setCarts((prev) =>
      prev.map((cartRow) => {
        if (cartRow.id !== activeCartId) return cartRow;
        const nextItems = cartRow.items.filter((item) => !(item.id === productId && item.priceSource === priceSource));
        return nextItems.length === cartRow.items.length ? cartRow : { ...cartRow, items: nextItems };
      })
    );
  };

  const setGramQtyFromInput = (productId: number, priceSource: CartPriceSource, value: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    if (!Number.isFinite(value)) return;
    const next = normalizeGramQty(value);
    setCarts((prev) =>
      prev.map((cartRow) =>
        cartRow.id !== activeCartId
          ? cartRow
          : {
              ...cartRow,
              items: cartRow.items
                .map((item) => (item.id === productId && item.priceSource === priceSource ? { ...item, qty: next } : item))
                .filter((item) => item.qty > 0)
            }
      )
    );
  };

  const setGramLineTotalFromTl = (productId: number, priceSource: CartPriceSource, tlStr: string) => {
    const trimmed = String(tlStr).trim();
    if (trimmed === "") {
      setGramQtyFromInput(productId, priceSource, 0);
      return;
    }
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const line = cart.find((i) => i.id === productId && i.priceSource === priceSource);
    if (!line) return;
    const tlPer1000 = effectiveTlPer1000gForLine(line, customerLineDiscPct, applyCardListPrice);
    if (tlPer1000 <= 0) {
      window.alert("Birim fiyat sifir; tutardan gram hesaplanamadi.");
      return;
    }
    const totalTl = parseTrAmountWhole(trimmed);
    if (totalTl == null || totalTl <= 0) {
      setGramQtyFromInput(productId, priceSource, 0);
      return;
    }
    const rawGrams = gramsFromLineTotalTl(totalTl, tlPer1000);
    if (rawGrams == null) {
      setGramQtyFromInput(productId, priceSource, 0);
      return;
    }
    setGramQtyFromInput(productId, priceSource, rawGrams);
  };

  const setLineManualPriceTl = (productId: number, priceSource: CartPriceSource, tlStr: string) => {
    const trimmed = String(tlStr).trim();
    if (trimmed === "") {
      setCarts((prev) =>
        prev.map((cartRow) =>
          cartRow.id !== activeCartId
            ? cartRow
            : {
                ...cartRow,
                items: cartRow.items.map((item) =>
                  item.id === productId && item.priceSource === priceSource ? { ...item, manualUnitPriceKurus: null } : item
                )
              }
        )
      );
      return;
    }
    const n = parseTrAmount(trimmed);
    const product = products.find((p) => p.id === productId);
    const unit = product ? saleUnitFor(categories, product) : "piece";
    let kurus: number | null = null;
    if (n != null && n >= 0) {
      kurus = unit === "gram" ? tlPer1000gToKurusPerGram(n) : tlToKurus(n);
    }
    setCarts((prev) =>
      prev.map((cartRow) =>
        cartRow.id !== activeCartId
          ? cartRow
          : {
              ...cartRow,
              items: cartRow.items.map((item) =>
                item.id === productId && item.priceSource === priceSource
                  ? { ...item, manualUnitPriceKurus: kurus != null && kurus > 0 ? kurus : null }
                  : item
              )
            }
      )
    );
  };

  const setLineExtraDiscount = (productId: number, priceSource: CartPriceSource, pct: number) => {
    const d = Math.max(0, Math.min(100, Number(pct) || 0));
    setCarts((prev) =>
      prev.map((cartRow) =>
        cartRow.id !== activeCartId
          ? cartRow
          : {
              ...cartRow,
              items: cartRow.items.map((item) =>
                item.id === productId && item.priceSource === priceSource ? { ...item, lineExtraDiscountPercent: d } : item
              )
            }
      )
    );
  };

  const createNewCart = () => {
    setCarts((prev) => {
      const nextId = Math.max(...prev.map((c) => c.id), 0) + 1;
      const next = [...prev, { id: nextId, name: `Sepet ${prev.length + 1}`, items: [], cardSpecialTl: "" }];
      const { carts, activeId } = normalizeCartBuckets(next, nextId);
      setActiveCartId(activeId);
      return carts;
    });
  };

  const closeCart = (cartId: number) => {
    setCarts((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((c) => c.id !== cartId);
      const nextActive =
        activeCartId === cartId ? (filtered[0]?.id ?? 1) : activeCartId;
      const { carts, activeId } = normalizeCartBuckets(filtered, nextActive);
      setActiveCartId(activeId);
      return carts;
    });
  };

  const salePayload = () => cart.map((x) => lineToSaleInput(x, categories, customerLineDiscPct, applyCardListPrice));

  const completeSale = async () => {
    if (!cart.length) return;
    const negativeStockLines: Array<{ name: string; qty: number; stockQty: number; unit: CategorySaleUnit }> = [];
    for (const ln of cart) {
      const unit = saleUnitFor(categories, ln);
      const live = products.find((x) => x.id === ln.id);
      if (!live) {
        window.alert(`Urun bulunamadi (id ${ln.id}).`);
        return;
      }
      if (unit === "gram") {
        if (!Number.isFinite(ln.qty) || normalizeGramQty(ln.qty) < 1) {
          window.alert(`Gramajli "${ln.name}" icin satilan gram en az 1 olmalidir (tam sayi).`);
          return;
        }
      } else if (!Number.isFinite(ln.qty) || ln.qty < 1 || !Number.isInteger(ln.qty)) {
        window.alert(`Adetli "${ln.name}" icin miktar en az 1 tam sayi olmalidir.`);
        return;
      }
      if (saleKind === "sale" && qtyExceedsStock(ln.qty, live.stockQty, unit)) {
        negativeStockLines.push({ name: ln.name, qty: ln.qty, stockQty: live.stockQty, unit });
      }
    }
    if (saleKind === "sale" && negativeStockLines.length > 0 && !confirmNegativeStockSale(negativeStockLines)) {
      return;
    }
    if (saleShortfallKurus > 0 && !selectedPosCustomerId) {
      window.alert("Eksik odeme musteri borcuna yazilacak. Lutfen once musteri secin veya tam tutari alin.");
      return;
    }
    if ((saleShortfallKurus > 0 || saleDebtPaymentKurus > 0) && selectedPosCustomerId) {
      const c = customers.find((x) => x.id === selectedPosCustomerId);
      const label = c?.name ?? "Musteri";
      const parts: string[] = [];
      if (saleDebtPaymentKurus > 0) {
        parts.push(`${formatTry(saleDebtPaymentKurus)} mevcut borctan dusulecek`);
      }
      if (saleShortfallKurus > 0) {
        parts.push(`${formatTry(saleShortfallKurus)} yeni borc eklenecek`);
      }
      const after = customerDebtAfterSaleKurus;
      if (
        !window.confirm(
          `${label}: ${parts.join("; ")}. Satis sonrasi borc: ${formatTry(after)}. Onayliyor musunuz?`
        )
      ) {
        return;
      }
    }
    const saleCartName = activeCart?.name || `Sepet ${activeCartId}`;
    try {
    await getMarinaApi().createSale(
      salePayload(),
      paymentType,
      paidAmountKurus,
      saleKind,
      saleCartName,
      selectedPosCustomerId,
      saleKind === "sale" ? cardExtraKurus : 0
    );
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Satis kaydedilemedi.");
      return;
    }
    await refreshCustomers();
    setCarts((prev) => {
      if (prev.length <= 1) {
        setActiveCartId(1);
        return [{ id: 1, name: "Sepet 1", items: [], cardSpecialTl: "" }];
      }
      const remaining = prev.filter((x) => x.id !== activeCartId);
      const { carts, activeId } = normalizeCartBuckets(remaining, remaining[0]?.id ?? 1);
      setActiveCartId(activeId);
      return carts;
    });
    setPaidAmountTl("");
    resetPosSaleDefaults();
    await onSaleCompleted();
    await loadDailySales();
    void refreshCustomers();
  };

  const posAddCustomerAsContact = (): ContactFormShape => ({
    name: addCustomerForm.name,
    balanceTl: addCustomerForm.balanceTl,
    phone: addCustomerForm.phone,
    email: addCustomerForm.email,
    address: addCustomerForm.address,
    district: addCustomerForm.district,
    city: addCustomerForm.city,
    taxOffice: "",
    taxNumber: addCustomerForm.taxOrVkn,
    note: addCustomerForm.note
  });

  const patchPosAddCustomerForm = (patch: Partial<ContactFormShape>) => {
    setAddCustomerForm((p) => ({
      ...p,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.balanceTl !== undefined ? { balanceTl: patch.balanceTl } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      ...(patch.email !== undefined ? { email: patch.email } : {}),
      ...(patch.address !== undefined ? { address: patch.address } : {}),
      ...(patch.district !== undefined ? { district: patch.district } : {}),
      ...(patch.city !== undefined ? { city: patch.city } : {}),
      ...(patch.taxNumber !== undefined ? { taxOrVkn: patch.taxNumber } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {})
    }));
  };

  const submitAddCustomer = async () => {
    const name = addCustomerForm.name.trim();
    if (!name) {
      window.alert("Ad gerekli.");
      return;
    }
    const bal = Number(String(addCustomerForm.balanceTl).replace(",", "."));
    const disc = Number(String(addCustomerForm.discountPct).replace(",", "."));
    const payload: CustomerInput = {
      kind: addCustomerKind,
      name,
      phone: addCustomerForm.phone.trim(),
      email: addCustomerForm.email.trim(),
      companyName: addCustomerForm.companyName.trim(),
      address: addCustomerForm.address.trim(),
      district: addCustomerForm.district.trim(),
      city: addCustomerForm.city.trim(),
      taxOrVkn: addCustomerForm.taxOrVkn.trim(),
      note: addCustomerForm.note.trim(),
      balanceOwedKurus: Number.isFinite(bal) && bal >= 0 ? tlToKurus(bal) : 0,
      suggestedDiscountPercent: Number.isFinite(disc) ? Math.max(0, Math.min(100, disc)) : 0
    };
    try {
      const created = await getMarinaApi().createCustomer(payload);
      setAddCustomerOpen(false);
      setAddCustomerForm({
        name: "",
        phone: "",
        email: "",
        companyName: "",
        address: "",
        district: "",
        city: "",
        taxOrVkn: "",
        note: "",
        balanceTl: "",
        discountPct: ""
      });
      setCustomers((prev) => {
        if (prev.some((c) => c.id === created.id)) return prev;
        return [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "tr"));
      });
      setSelectedPosCustomerId(created.id);
      await refreshCustomers();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Musteri eklenemedi.");
    }
  };

  const submitCustomerDetailModal = async () => {
    if (!customerDetailCustomer) return;
    const name = customerDetailForm.name.trim();
    if (!name) {
      window.alert("Ad / unvan bos olamaz.");
      return;
    }
    const bal = Number(String(customerDetailForm.balanceTl).replace(",", "."));
    const disc = Number(String(customerDetailForm.discountPct).replace(",", "."));
    setCustomerDetailSaving(true);
    try {
      await getMarinaApi().updateCustomer(customerDetailCustomer.id, {
        name,
        phone: customerDetailForm.phone.trim(),
        email: customerDetailForm.email.trim(),
        companyName: customerDetailForm.companyName.trim(),
        address: customerDetailForm.address.trim(),
        district: customerDetailForm.district.trim(),
        city: customerDetailForm.city.trim(),
        taxOrVkn: customerDetailForm.taxOrVkn.trim(),
        note: customerDetailForm.note.trim(),
        balanceOwedKurus: Number.isFinite(bal) && bal >= 0 ? tlToKurus(bal) : 0,
        suggestedDiscountPercent: Number.isFinite(disc) ? Math.max(0, Math.min(100, disc)) : 0
      });
      setCustomerDetailCustomer(null);
      await refreshCustomers();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Guncellenemedi.");
    } finally {
      setCustomerDetailSaving(false);
    }
  };

  const patchSelectedCustomer = async (patch: Partial<CustomerInput>) => {
    if (!selectedPosCustomerId) return;
    try {
      await getMarinaApi().updateCustomer(selectedPosCustomerId, patch);
      await refreshCustomers();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Guncellenemedi.");
    }
  };

  const markSelectedCustomerDebtPaid = async () => {
    if (!selectedPosCustomer || selectedPosCustomer.balanceOwedKurus <= 0) return;
    const label = selectedPosCustomer.name;
    const amount = formatTry(selectedPosCustomer.balanceOwedKurus);
    const payLabel = paymentType === "card" ? "kart" : "nakit";
    if (
      !window.confirm(
        `${label} icin acik borc (${amount}) ${payLabel} olarak tahsil edilsin mi? Tutar bugunun satislari ve gelire yazilir.`
      )
    ) {
      return;
    }
    try {
      await getMarinaApi().recordCustomerDebtPayment(
        selectedPosCustomer.id,
        paymentType === "card" ? "card" : "cash"
      );
      await refreshCustomers();
      const api = getMarinaApi();
      const [sales, productIds] = await Promise.all([api.getDailySales(today), api.getDailySaleProductIds(today)]);
      setDailySales(sales);
      setDailySaleProductIds(productIds);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Borc tahsilati kaydedilemedi.");
    }
  };

  const openProductContextMenu = (
    e: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number },
    product: Product
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const pad = 8;
    const menuW = 220;
    const menuH = 120;
    const x = Math.max(pad, Math.min(e.clientX, window.innerWidth - menuW - pad));
    const y = Math.max(pad, Math.min(e.clientY, window.innerHeight - menuH - pad));
    setProductContext({ x, y, product });
  };

  const refreshPosCatalog = useCallback(async () => {
    await onDataRefresh?.();
  }, [onDataRefresh]);

  const openEditModal = (product: Product) => {
    setProductContext(null);
    setEditProduct(product);
    const editUnit = categorySaleUnitOf(categories, product.categoryId);
    setEditForm({
      name: product.name ?? "",
      description: product.description ?? "",
      barcode: product.barcode ?? "",
      code: product.code ?? "",
      categoryId: product.categoryId ?? 0,
      supplierId: product.supplierId ?? 0,
      priceTl: (editUnit === "gram" ? kurusPerGramToTlPer1000g(product.priceKurus) : product.priceKurus / 100).toFixed(2),
      sellsWholesale: product.wholesalePriceKurus > 0,
      wholesaleTl:
        product.wholesalePriceKurus > 0
          ? (editUnit === "gram" ? kurusPerGramToTlPer1000g(product.wholesalePriceKurus) : product.wholesalePriceKurus / 100).toFixed(2)
          : "",
      alternateTl:
        product.alternatePriceKurus > 0
          ? (editUnit === "gram" ? kurusPerGramToTlPer1000g(product.alternatePriceKurus) : product.alternatePriceKurus / 100).toFixed(2)
          : "",
      posFavorite: product.posFavorite === 1,
      discountPercent: String(product.discountPercent ?? 0),
      costTl: (editUnit === "gram" ? kurusPerGramToTlPer1000g(product.costPriceKurus) : product.costPriceKurus / 100).toFixed(2),
      stockQty: String(Math.round(product.stockQty ?? 0)),
      material: product.material ?? "",
      vatRatePercent: String(product.vatRatePercent ?? 20),
      priceIncludesVat: product.priceIncludesVat !== false,
      domesticMade: product.domesticMade === true,
      imagePath: product.imagePath ?? ""
    });
  };

  const pickEditImage = async () => {
    const selectedPath = await getMarinaApi().selectImage(editForm?.name?.trim() || editProduct?.name || "urun");
    if (selectedPath) setEditForm((prev) => (prev ? { ...prev, imagePath: selectedPath } : prev));
  };

  const saveProductEdit = async () => {
    if (!editProduct || !editForm) return;
    const nameTrim = editForm.name.trim();
    const barcode = editForm.barcode.trim();
    const code = editForm.code.trim();
    const priceTl = Number(String(editForm.priceTl).replace(",", "."));
    const wholesaleTl = Number(String(editForm.wholesaleTl).replace(",", "."));
    const alternateTl = Number(String(editForm.alternateTl).replace(",", "."));
    const discountPercent = Number(editForm.discountPercent || 0);
    const costTl = Number(String(editForm.costTl).replace(",", "."));
    const stockQty = Number(String(editForm.stockQty).replace(",", "."));
    const vatRatePercent = Number(editForm.vatRatePercent || 20);
    const editUnit = categorySaleUnitOf(categories, Math.max(0, Math.floor(Number(editForm.categoryId || 0))));
    if (!nameTrim || !barcode || !code) return;
    if (!Number.isFinite(priceTl) || priceTl <= 0) return;
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) return;
    if (!Number.isFinite(costTl) || costTl < 0) return;
    if (!Number.isFinite(stockQty) || stockQty < 0) return;
    const savedStockQty = editUnit === "gram" ? Math.round(stockQty) : stockQty;
    if (!Number.isFinite(vatRatePercent) || vatRatePercent < 0 || vatRatePercent > 100) return;
    await getMarinaApi().updateProduct(editProduct.id, {
      name: nameTrim,
      description: editForm.description.trim(),
      barcode,
      code,
      categoryId: Math.max(0, Math.floor(Number(editForm.categoryId || 0))),
      supplierId: Math.max(0, Math.floor(Number(editForm.supplierId || 0))),
      priceKurus: editUnit === "gram" ? tlPer1000gToKurusPerGram(priceTl) : tlToKurus(priceTl),
      wholesalePriceKurus:
        editForm.sellsWholesale && Number.isFinite(wholesaleTl) && wholesaleTl > 0
          ? editUnit === "gram"
            ? tlPer1000gToKurusPerGram(wholesaleTl)
            : tlToKurus(wholesaleTl)
          : 0,
      alternatePriceKurus:
        Number.isFinite(alternateTl) && alternateTl > 0
          ? editUnit === "gram"
            ? tlPer1000gToKurusPerGram(alternateTl)
            : tlToKurus(alternateTl)
          : 0,
      posFavorite: editForm.posFavorite ? 1 : 0,
      discountPercent,
      costPriceKurus: editUnit === "gram" ? tlPer1000gToKurusPerGram(costTl) : tlToKurus(costTl),
      stockQty: savedStockQty,
      material: editForm.material.trim(),
      vatRatePercent,
      priceIncludesVat: editForm.priceIncludesVat,
      domesticMade: editForm.domesticMade,
      imagePath: editForm.imagePath.trim()
    });
    setEditProduct(null);
    setEditForm(null);
    await onSaleCompleted();
  };

  const openInvoicePreview = async () => {
    if (!cart.length) return;
    setInvoiceLoading(true);
    setInvoicePreviewOpen(true);
    try {
      const html = await getMarinaApi().previewInvoice(
        salePayload(),
        paymentType,
        saleKind,
        invoiceCustomer,
        saleKind === "sale" ? cardExtraKurus : 0
      );
      setInvoicePreviewHtml(html || "");
    } finally {
      setInvoiceLoading(false);
    }
  };

  const createInvoice = async () => {
    if (!cart.length) return;
    const filePath = await getMarinaApi().createInvoice(
      salePayload(),
      paymentType,
      saleKind,
      invoiceCustomer,
      saleKind === "sale" ? cardExtraKurus : 0
    );
    if (filePath) await getMarinaApi().showItemInFolder(filePath);
  };

  const printInvoicePreview = () => {
    const frame = invoiceFrameRef.current;
    if (!frame?.contentWindow) return;
    frame.contentWindow.focus();
    frame.contentWindow.print();
  };

  const dialCustomer = () => {
    const raw = (invoiceCustomer.phone ?? "").replace(/\s/g, "");
    if (!raw) return;
    const n = raw.startsWith("+") ? raw : raw.replace(/^0/, "90");
    const api = getMarinaApi();
    if (typeof api.openExternalUrl === "function") {
      void api.openExternalUrl(`tel:${n}`);
    }
  };

  const customerField = (key: keyof InvoiceCustomerInfo, label: string, placeholder: string) => (
    <label className="settings-field" key={key}>
      <span>{label}</span>
      <input
        value={String(invoiceCustomer[key] ?? "")}
        placeholder={placeholder}
        onChange={(e) => setInvoiceCustomer((p) => ({ ...p, [key]: e.target.value }))}
      />
    </label>
  );

  const openSaleDetail = async (saleId: number) => {
    const api = getMarinaApi();
    if (typeof api.getSaleWithLines !== "function") return;
    const row = await api.getSaleWithLines(saleId);
    if (row) setDetailOpen(row);
  };

  const openSaleDetailFromCustomerModal = (saleId: number) => {
    setCustomerDetailCustomer(null);
    void openSaleDetail(saleId);
  };

  const applyReturnFromDetail = async () => {
    if (!detailOpen || detailOpen.sale.kind !== "sale") return;
    if (cart.length > 0 && !window.confirm("Sepetteki urunler silinsin ve bu satis iade sepetine alinsin mi?")) {
      return;
    }
    const api = getMarinaApi();
    const lines: PosCartLine[] = [];
    for (const ln of detailOpen.items) {
      if (ln.productId < 0 || (ln.productName ?? "").includes("Kart (Ozel)")) continue;
      let p: Product | null = products.find((x) => x.id === ln.productId) ?? null;
      if (!p && typeof api.getProductById === "function") {
        p = await api.getProductById(ln.productId);
      }
      if (!p) {
        window.alert(`Urun bulunamadi (ID ${ln.productId}): ${ln.productName}`);
        continue;
      }
      const qty = Math.abs(Number(ln.qty));
      const unit = Math.max(0, Math.round(Number(ln.unitPriceKurus)));
      lines.push({
        ...p,
        qty,
        priceSource: "retail",
        manualUnitPriceKurus: unit,
        manualUnitCostKurus: null,
        lineExtraDiscountPercent: 0
      });
    }
    if (lines.length === 0) {
      window.alert("Sepete alinacak satir kalmadi.");
      return;
    }
    setCarts((prev) => prev.map((c) => (c.id === activeCartId ? { ...c, items: lines } : c)));
    setSaleKind("return");
    setPaymentType(detailOpen.sale.paymentType);
    setPaidAmountTl("");
    setDetailOpen(null);
    setPosPane("main");
  };

  useEffect(() => {
    if (posPane !== "main") return;
    let scannerBuffer = "";
    let lastKeyMs = 0;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      const t = event.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable='true']")) {
        return;
      }
      const now = Date.now();
      if (now - lastKeyMs > 100) scannerBuffer = "";
      lastKeyMs = now;
      if (event.key === "Enter") {
        const barcode = scannerBuffer.trim();
        scannerBuffer = "";
        if (barcode.length < 4) return;
        setSearch(barcode);
        const found = products.find((p) => p.barcode === barcode && p.isActive === 1);
        if (found) addToCart(found, cartAddPriceSource);
        return;
      }
      if (event.key.length === 1) {
        scannerBuffer += event.key;
        setSearch(scannerBuffer);
        if (resetTimer) clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
          scannerBuffer = "";
        }, 250);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, [products, categories, activeCartId, posPane, addToCart, cartAddPriceSource]);

  const vatLabel = (p: Product) => (p.priceIncludesVat ? "KDV dahil" : `KDV %${p.vatRatePercent ?? 20} (+)`);

  return (
    <div
      className={`pos-grid${posPane === "main" ? " pos-grid-main" : posPane === "ledger" ? " pos-grid-ledger-tab" : " pos-grid-today-tab"}`}
    >
      <nav className="pos-pane-tabs" aria-label="Satis">
        <button type="button" className={posPane === "main" ? "active" : ""} onClick={() => setPosPane("main")}>
          Satis
        </button>
        <button type="button" className={posPane === "today" ? "active" : ""} onClick={() => setPosPane("today")}>
          Bugunun satislari
        </button>
        <button type="button" className={posPane === "ledger" ? "active" : ""} onClick={() => setPosPane("ledger")}>
          Kayit Defteri
        </button>
      </nav>

      {posPane === "main" && (
        <>
          <section className="products-panel">
                <label className="search-wrap">
                  <span className="search-icon">⌕</span>
                  <input
                    className="search"
                    placeholder="Ad, kod veya barkod ile ara (barkod okuyucu bu alana yazar)"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      const barcode = search.trim();
                      if (barcode.length < 4) return;
                      e.preventDefault();
                      const found = products.find((p) => p.barcode === barcode && p.isActive === 1);
                      if (found) addToCart(found, cartAddPriceSource);
                    }}
                  />
                </label>
                <div className="pos-catalog-filter" aria-label="Urun grubu ve kategori">
                  <motion.div className="pos-catalog-filter-row" layout>
                    <label className="pos-catalog-select-field">
                      <span>Satis birimi</span>
                      <select
                        value={posSaleUnitFilter}
                        onChange={(e) => {
                          setPosSaleUnitFilter(e.target.value as PosCatalogUnitFilter);
                          setPosCategoryFilter(0);
                        }}
                      >
                        <option value="all">Tumu</option>
                        <option value="piece">Adet</option>
                        <option value="gram">Gramajli</option>
                      </select>
                    </label>
                    <label className="pos-catalog-select-field pos-catalog-select-field-grow">
                      <span>Kategori</span>
                      <select
                        value={posCategoryFilter}
                        disabled={posSaleUnitFilter === "all"}
                        onChange={(e) => setPosCategoryFilter(Number(e.target.value))}
                      >
                        <option value={0}>
                          {posSaleUnitFilter === "all" ? "Once satis birimi secin" : "Bu gruptaki tumu"}
                        </option>
                        {posCategoriesForUnit.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </motion.div>
                  {posSaleUnitFilter !== "all" && posCategoriesForUnit.length === 0 ? (
                    <p className="pos-catalog-filter-hint muted small">
                      Bu birimde henuz kategori yok. Urun Ekle sekmesinden kategori olusturun.
                    </p>
                  ) : null}
                </div>
                <div className="pos-catalog-layout">
                {favoriteSaleProducts.length > 0 && (
                  <div className="favorite-sale-strip">
                    <h3 className="favorite-sale-title">Favori Satış</h3>
                    <div className="favorite-sale-row">
                      {favoriteSaleProducts.map((product) => (
                        <button key={product.id} type="button" className="favorite-sale-card" onClick={() => addToCart(product, cartAddPriceSource)}>
                          {isProductLowStock(product, categories, lowStockThreshold) ? (
                            <span className="favorite-sale-low-badge" title="Eksik stok">
                              {formatLowStockRemainLabel(product, categories)}
                            </span>
                          ) : null}
                          <span className="favorite-sale-name">{product.name}</span>
                          <span className="favorite-sale-amt">
                            {formatPosUnitPrice(
                              effectiveUnitKurusForLine(newLineFromProduct(product, 1, cartAddPriceSource), customerLineDiscPct, applyCardListPrice, categories),
                              categories,
                              product.categoryId
                            )}
                          </span>
                          <span className="favorite-sale-meta">{vatLabel(product)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className={`favorite-sale-strip top-sellers-strip${topSellersOpen ? " is-open" : ""}`}>
                  <button
                    type="button"
                    className="top-sellers-toggle"
                    aria-expanded={topSellersOpen}
                    aria-controls="pos-top-sellers-panel"
                    onClick={() => setTopSellersOpen((open) => !open)}
                  >
                    <span className="top-sellers-burger" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                    <span className="favorite-sale-title top-sellers-toggle-title">En Cok Satanlar</span>
                    {quickSaleProducts.length > 0 ? (
                      <span className="top-sellers-badge">{quickSaleProducts.length}</span>
                    ) : null}
                  </button>
                  <div id="pos-top-sellers-panel" className="top-sellers-body">
                    {quickSaleProducts.length === 0 ? (
                      <p className="quick-sales-empty">Satis arttikca bu alan otomatik dolacak.</p>
                    ) : (
                      <div className="favorite-sale-row">
                        {quickSaleProducts.map((row) => (
                          <button
                            key={row.productId}
                            type="button"
                            className="favorite-sale-card"
                            onClick={() => addToCart(row.product, cartAddPriceSource)}
                          >
                            <span className="favorite-sale-name">{row.product.name}</span>
                            <span className="favorite-sale-amt">
                              {formatPosUnitPrice(
                                effectiveUnitKurusForLine(
                                  newLineFromProduct(row.product, 1, cartAddPriceSource),
                                  customerLineDiscPct,
                                  applyCardListPrice,
                                  categories
                                ),
                                categories,
                                row.product.categoryId
                              )}
                            </span>
                            <span className="favorite-sale-meta">{row.qty.toFixed(0)} satis</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="product-grid" role="region" aria-label="Urun listesi">
                    {filteredProducts.length === 0 && (
                      <div className="empty-silhouette">
                        <span>🫧</span>
                        <p>Urun bulunamadi. Barkod veya urun adi ile arayin.</p>
                      </div>
                    )}
                    {filteredProducts.map((product) => (
                      <motion.button
                        layout
                        whileHover={{ y: -2, borderColor: "#b88f43" }}
                        whileTap={{ scale: 0.98 }}
                        key={product.id}
                        className="product-card"
                        onClick={() => addToCart(product, cartAddPriceSource)}
                        onContextMenu={(e) => openProductContextMenu(e, product)}
                      >
                        <div className="price-tag">
                          {formatPosUnitPrice(
                            effectiveUnitKurusForLine(newLineFromProduct(product, 1, cartAddPriceSource), customerLineDiscPct, applyCardListPrice),
                            categories,
                            product.categoryId
                          )}
                          <small className="price-tag-vat">{vatLabel(product)}</small>
                        </div>
                        <div className="image-placeholder">
                          {saleUnitFor(categories, product) === "piece" && product.stockQty <= 0 ? (
                            <span className="product-zero-stock-badge" title="Stok yok; satista onay istenir">
                              Stok yok
                            </span>
                          ) : isProductLowStock(product, categories, lowStockThreshold) ? (
                            <span className="product-low-stock-badge" title="Eksik stok listesinde">
                              {formatLowStockRemainLabel(product, categories)}
                            </span>
                          ) : null}
                          {(() => {
                            const path = product.imagePath.trim();
                            const cached = imageSrcMap[path];
                            const src = cached || resolveImageSrc(product.imagePath);
                            const sourceMode = cached ? "cached" : "raw";
                            const errKey = `${product.id}:${path}:${sourceMode}`;
                            if (!path || imageLoadErrors[errKey]) return "Resim";
                            return (
                              <img
                                src={src}
                                alt={product.name}
                                className="product-image"
                                onError={() =>
                                  setImageLoadErrors((prev) => ({
                                    ...prev,
                                    [errKey]: true
                                  }))
                                }
                                onLoad={() =>
                                  setImageLoadErrors((prev) => {
                                    if (!prev[errKey]) return prev;
                                    const next = { ...prev };
                                    delete next[errKey];
                                    return next;
                                  })
                                }
                              />
                            );
                          })()}
                        </div>
                        <div className="product-card-info">
                          <strong className="product-card-name">{product.name}</strong>
                          <small className="product-card-line">
                            Stok:{" "}
                            {formatQtyShort(
                              product.stockQty,
                              saleUnitFor(categories, product) === "gram" ? "gram" : "piece"
                            )}
                            {" · "}
                            Kod: {product.code}
                          </small>
                          <small className="product-card-line">Barkod: {product.barcode}</small>
                        </div>
                      </motion.button>
                    ))}
                </div>
                </div>
          </section>

          <div className="pos-sidebar">
          <section className="cart-panel">
            <h2>Sepet</h2>
            <p className="cart-gram-pricing-hint muted small">
              Gramaj tam sayi (g). Fiyat <strong>TL / 1000 g</strong> (1 kg); tutar = birim × gram ÷ 1000. Ornek 1200 TL/kg,
              1000 g = 1200 TL. Urun eklenince varsayilan <strong>1000 g</strong>.
            </p>
            <div className="payment-segment">
              {carts.map((c) => (
                <button key={c.id} className={activeCartId === c.id ? "active" : ""} onClick={() => setActiveCartId(c.id)}>
                  {c.name} ({c.items.length})
                </button>
              ))}
              <button type="button" onClick={createNewCart}>
                + Yeni
              </button>
              {carts.length > 1 && (
                <button type="button" onClick={() => closeCart(activeCartId)}>
                  Sepeti Kapat
                </button>
              )}
            </div>
            <div className="payment-segment">
              <button className={saleKind === "sale" ? "active" : ""} onClick={() => setSaleKind("sale")}>
                Satis
              </button>
              <button className={saleKind === "return" ? "active" : ""} onClick={() => setSaleKind("return")}>
                Iade
              </button>
            </div>
            <div className="payment-segment" role="group" aria-label="Sepet fiyat turu">
              <button
                type="button"
                className={cartPriceMode === "retail" ? "active" : ""}
                onClick={() => setCartPriceMode("retail")}
              >
                Perakende
              </button>
              <button
                type="button"
                className={cartPriceMode === "wholesale" ? "active" : ""}
                onClick={() => setCartPriceMode("wholesale")}
              >
                Toptan
              </button>
            </div>
            <AnimatePresence>
              {cart.map((item) => (
                <motion.div
                  key={`${item.id}-${item.priceSource}`}
                  className="cart-row cart-row-extended"
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 18 }}
                >
                  <div
                    className={`cart-row-main${saleUnitFor(categories, item) === "gram" ? " cart-row-main--gram" : " cart-row-main--piece"}`}
                  >
                    <div className="cart-row-header">
                      <div className="cart-row-title-block">
                        <span className="cart-row-name">{item.name}</span>
                        <small className="cart-price-source">
                          {item.manualUnitPriceKurus != null
                            ? "Ozel birim"
                            : item.priceSource === "wholesale"
                              ? "Toptan"
                              : applyCardListPrice && item.alternatePriceKurus > 0
                                ? "Kart"
                                : item.priceSource === "alternate"
                                  ? "Kart"
                                  : "Perakende"}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="cart-line-remove"
                        title="Sepetten cikar"
                        aria-label={`${item.name} sepetten cikar`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeFromCart(item.id, item.priceSource);
                        }}
                      >
                        Sil
                      </button>
                    </div>
                    {saleUnitFor(categories, item) === "gram" ? (
                      <div className="cart-gram-body">
                        <div className="cart-inline-fields cart-inline-fields--gram">
                          <CartGramQtyField
                            qty={item.qty}
                            onCommit={(grams) => setGramQtyFromInput(item.id, item.priceSource, grams)}
                          />
                          <CartGramUnitPriceField
                            manualUnitPriceKurus={item.manualUnitPriceKurus}
                            autoTlPer1000gPlaceholder={effectiveTlPer1000gForLine(
                              { ...item, manualUnitPriceKurus: null },
                              customerLineDiscPct,
                              applyCardListPrice
                            )}
                            readOnly={item.priceSource !== "wholesale"}
                            label={
                              item.priceSource === "wholesale"
                                ? "Toptan birim (TL / 1000 g)"
                                : "Birim (TL / 1000 g)"
                            }
                            onCommit={(tl) => setLineManualPriceTl(item.id, item.priceSource, tl)}
                            onClear={
                              item.priceSource !== "wholesale"
                                ? () => setLineManualPriceTl(item.id, item.priceSource, "")
                                : undefined
                            }
                          />
                          <CartGramSaleTlField
                            lineTotalTl={lineTotalTlForCart(item, categories, customerLineDiscPct, applyCardListPrice)}
                            onCommit={(tl) => setGramLineTotalFromTl(item.id, item.priceSource, tl)}
                          />
                          <label className="cart-field">
                            <span className="cart-field-label">Ind. %</span>
                            <input
                              type="number"
                              className="cart-field-input"
                              min={0}
                              max={100}
                              step={0.5}
                              value={item.lineExtraDiscountPercent || ""}
                              onChange={(e) => setLineExtraDiscount(item.id, item.priceSource, Number(e.target.value))}
                            />
                          </label>
                          <div className="cart-field cart-field-total">
                            <span className="cart-field-label">Toplam</span>
                            <span className="cart-line-total">
                              {`${formatTlWhole(lineTotalTlForCart(item, categories, customerLineDiscPct, applyCardListPrice))} ₺`}
                            </span>
                          </div>
                        </div>
                        {(() => {
                          const birim = effectiveTlPer1000gForLine(item, customerLineDiscPct, applyCardListPrice);
                          const gram = Math.round(item.qty);
                          const tutar = lineTotalTlForCart(item, categories, customerLineDiscPct, applyCardListPrice);
                          const formula =
                            birim > 0 && gram > 0
                              ? `${formatTlWhole(birim)}/kg × ${gram} g ÷ 1000 = ${formatTlWhole(tutar)} TL`
                              : "Gram ve birim fiyat girin; tutar otomatik hesaplanir.";
                          return (
                            <p className="cart-gram-formula-hint muted small">
                              {item.priceSource === "wholesale" ? "Toptan: " : null}
                              {formula}
                            </p>
                          );
                        })()}
                        {(() => {
                          const live = products.find((p) => p.id === item.id);
                          if (!live || saleKind !== "sale") return null;
                          if (qtyExceedsStock(item.qty, live.stockQty, "gram")) {
                            return (
                              <span className="cart-gram-stock-cap cart-over-stock-hint" title="Stoktan fazla; satista onay istenir">
                                Stoktan fazla
                              </span>
                            );
                          }
                          return (
                            <span className="cart-gram-stock-cap muted small" title="Mevcut stok">
                              Stok: {formatQtyShort(live.stockQty, "gram")}
                            </span>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="cart-piece-body">
                        <div className="cart-inline-fields">
                          <div className="cart-field cart-field-qty">
                            <span className="cart-field-label">Adet</span>
                            <div className="cart-qty-stepper">
                              <button type="button" onClick={() => changeQty(item.id, item.priceSource, -1)}>
                                -
                              </button>
                              <input
                                type="number"
                                className="cart-field-input cart-qty-input"
                                min={1}
                                step={1}
                                value={item.qty}
                                onChange={(e) => setPieceQtyFromInput(item.id, item.priceSource, Number(e.target.value))}
                              />
                              <button type="button" onClick={() => changeQty(item.id, item.priceSource, 1)}>
                                +
                              </button>
                            </div>
                          </div>
                          <CartUnitPriceField
                            manualUnitPriceKurus={item.manualUnitPriceKurus}
                            autoUnitKurusPlaceholder={effectiveUnitKurusForLine(
                              { ...item, manualUnitPriceKurus: null },
                              customerLineDiscPct,
                              applyCardListPrice,
                              categories
                            )}
                            onCommit={(tl) => setLineManualPriceTl(item.id, item.priceSource, tl)}
                          />
                          <label className="cart-field">
                            <span className="cart-field-label">Ind. %</span>
                            <input
                              type="number"
                              className="cart-field-input"
                              min={0}
                              max={100}
                              step={0.5}
                              value={item.lineExtraDiscountPercent || ""}
                              onChange={(e) => setLineExtraDiscount(item.id, item.priceSource, Number(e.target.value))}
                            />
                          </label>
                          <div className="cart-field cart-field-total">
                            <span className="cart-field-label">Toplam</span>
                            {(() => {
                              const live = products.find((p) => p.id === item.id);
                              if (live && saleKind === "sale" && qtyExceedsStock(item.qty, live.stockQty, "piece")) {
                                return (
                                  <span className="cart-over-stock-hint" title="Stoktan fazla; satista onay istenir">
                                    Stoktan fazla
                                  </span>
                                );
                              }
                              return null;
                            })()}
                            <span className="cart-line-total">
                              {formatTry(lineTotalKurusForCart(item, categories, customerLineDiscPct, applyCardListPrice))}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div className="cart-totals-block">
              <table className="cart-payment-table" aria-label="Odeme ozeti">
                <tbody>
                  <tr>
                    <th scope="row">Urun toplami</th>
                    <td>{formatTry(linesTotalKurus)}</td>
                  </tr>
                  {saleKind === "sale" && paymentType === "card" && cardExtraKurus > 0 ? (
                    <tr>
                      <th scope="row">Kart (Ozel)</th>
                      <td>+{formatTry(cardExtraKurus)}</td>
                    </tr>
                  ) : null}
                  <tr className="cart-payment-table-total">
                    <th scope="row">Genel toplam</th>
                    <td>{formatTry(totalKurus)}</td>
                  </tr>
                  {saleKind === "sale" && (paymentType === "cash" || paymentType === "card") ? (
                    <>
                      <tr>
                        <th scope="row">{paymentType === "cash" ? "Alinan" : "Karttan cekilen"}</th>
                        <td>{formatTry(paidAmountKurus)}</td>
                      </tr>
                      {paymentType === "cash" && changeKurus > 0 ? (
                        <tr>
                          <th scope="row">Para ustu</th>
                          <td>{formatTry(changeKurus)}</td>
                        </tr>
                      ) : null}
                      {selectedPosCustomer && saleDebtPaymentKurus > 0 ? (
                        <tr className="cart-payment-table-debt cart-payment-table-debt--paid">
                          <th scope="row">Borca odeme</th>
                          <td>
                            <strong>-{formatTry(saleDebtPaymentKurus)}</strong>
                            <small className="cart-debt-hint"> → {selectedPosCustomer.name}</small>
                          </td>
                        </tr>
                      ) : null}
                      {selectedPosCustomer && saleShortfallKurus > 0 ? (
                        <tr className="cart-payment-table-debt">
                          <th scope="row">Borc (bu satis)</th>
                          <td>
                            <strong>{formatTry(saleShortfallKurus)}</strong>
                            <small className="cart-debt-hint"> → {selectedPosCustomer.name}</small>
                          </td>
                        </tr>
                      ) : null}
                      {saleShortfallKurus > 0 && !selectedPosCustomer ? (
                        <tr className="cart-payment-table-debt">
                          <th scope="row">Borc</th>
                          <td>
                            <small className="cart-debt-hint cart-debt-hint-warn">Musteri secin — aksi halde satis tamamlanamaz</small>
                          </td>
                        </tr>
                      ) : null}
                    </>
                  ) : null}
                </tbody>
              </table>
              {saleKind === "sale" && paymentType === "card" ? (
                <label className="cart-card-special">
                  <span className="cart-card-special-label">Kart (Ozel) TL</span>
                  <input
                    type="text"
                    className="cart-card-special-input"
                    inputMode="decimal"
                    placeholder="0"
                    value={activeCart?.cardSpecialTl ?? ""}
                    onChange={(e) =>
                      setCarts((prev) =>
                        prev.map((c) => (c.id === activeCartId ? { ...c, cardSpecialTl: e.target.value } : c))
                      )
                    }
                    aria-label="Kart ozel ek tutar TL"
                  />
                </label>
              ) : null}
            </div>
            <h3 className="cart-grand-total-visually-hidden">{saleKind === "return" ? "Iade Toplami" : "Genel toplam"}: {formatTry(totalKurus)}</h3>
            <div className="payment-segment">
              <button className={paymentType === "cash" ? "active" : ""} onClick={() => setPaymentType("cash")}>
                Nakit
              </button>
              <button className={paymentType === "card" ? "active" : ""} onClick={() => setPaymentType("card")}>
                Kart
              </button>
            </div>
            {saleKind === "sale" && paymentType === "card" ? (
              <p className="cart-card-price-hint muted small">
                Urun kartinda kart fiyati tanimliysa, sepette Toptan secili olmayan satirlarda o birim fiyat gecerlidir.
              </p>
            ) : null}
            {saleKind === "sale" && (paymentType === "cash" || paymentType === "card") ? (
              <>
                <input
                  type="number"
                  placeholder={
                    paymentType === "cash"
                      ? "Alinan para (bos birakilirsa tam tutar sayilir)"
                      : "Karttan cekilen (bos birakilirsa tam tutar sayilir)"
                  }
                  value={paidAmountTl}
                  onChange={(e) => setPaidAmountTl(e.target.value)}
                />
                <p className="change-hint muted small">
                  {selectedPosCustomer
                    ? paymentType === "cash"
                      ? "Genel toplamdan fazla alinan tutar once acik borca yazilir; kalan varsa para ustu verilir. Eksik odeme yeni borc olur."
                      : "Genel toplamdan fazla cekilen tutar acik borcu dusurur. Eksik cekim yeni borc olur."
                    : "Eksik odeme icin once musteri secin; aksi halde satis tamamlanamaz."}
                </p>
              </>
            ) : null}
            <button className="complete-btn" onClick={() => void completeSale()}>
              {saleKind === "return" ? "Iadeyi Tamamla" : "Satisi Tamamla"}
            </button>
            <div className="pos-cart-customer-footer">
              <div className="pos-cart-actions-row">
                <label className="pos-cart-action-cell pos-cart-customer-footer-field">
                  <span>Musteri sec</span>
                  <PosCartCustomerSelect
                    customers={customersSortedForSelect}
                    value={selectedPosCustomerId}
                    onChange={setSelectedPosCustomerId}
                  />
                </label>
                <div className="pos-cart-action-cell">
                  <span className="pos-cart-action-label">Yeni musteri</span>
                  <button type="button" className="pos-cart-customer-add-btn" onClick={() => setAddCustomerOpen(true)}>
                    + Yeni musteri
                  </button>
                </div>
                <div className="pos-cart-action-cell">
                  <span className="pos-cart-action-label">Fatura</span>
                  <button type="button" className="invoice-btn" onClick={() => void openInvoicePreview()}>
                    Fatura Olustur
                  </button>
                </div>
              </div>
              {selectedPosCustomer ? (
                <>
                  <div className="cart-debt-panel">
                    <div className="cart-debt-panel-head">
                      <span className="cart-debt-panel-title">Borc takibi</span>
                      <span className="cart-debt-panel-name">{selectedPosCustomer.name}</span>
                    </div>
                    <div className="cart-debt-panel-rows">
                      <div className="cart-debt-panel-row">
                        <span>Mevcut borc</span>
                        <strong>{formatTry(selectedPosCustomer.balanceOwedKurus)}</strong>
                      </div>
                      {saleKind === "sale" && (paymentType === "cash" || paymentType === "card") ? (
                        <>
                          <div
                            className={`cart-debt-panel-row${saleDebtPaymentKurus > 0 ? " cart-debt-panel-row--paid" : ""}`}
                          >
                            <span>Bu satista borca odeme</span>
                            <strong>{saleDebtPaymentKurus > 0 ? `-${formatTry(saleDebtPaymentKurus)}` : "—"}</strong>
                          </div>
                          <div className={`cart-debt-panel-row${saleShortfallKurus > 0 ? " cart-debt-panel-row--pending" : ""}`}>
                            <span>Bu satis borcu</span>
                            <strong>{saleShortfallKurus > 0 ? formatTry(saleShortfallKurus) : "—"}</strong>
                          </div>
                          <div className="cart-debt-panel-row cart-debt-panel-row--total">
                            <span>Satis sonrasi toplam</span>
                            <strong>{formatTry(customerDebtAfterSaleKurus)}</strong>
                          </div>
                        </>
                      ) : (
                        <p className="cart-debt-panel-hint muted small">
                          Nakit veya kart odemede tahsilat genel toplamdan dusukse fark musteri borcuna yazilir.
                        </p>
                      )}
                    </div>
                    {selectedPosCustomer.balanceOwedKurus > 0 ? (
                      <button
                        type="button"
                        className="cart-debt-panel-paid-btn"
                        onClick={() => void markSelectedCustomerDebtPaid()}
                      >
                        Borc tahsil edildi
                      </button>
                    ) : null}
                    {customerLineDiscPct > 0 ? (
                      <p className="pos-cart-customer-disc-hint">Musteriye %{customerLineDiscPct} indirim uygulaniyor.</p>
                    ) : null}
                    <div className="pos-cart-customer-footer-meta">
                      <button type="button" className="customer-clear-select pos-cart-customer-clear" onClick={clearPosCustomerSelection}>
                        Secimi kaldir
                      </button>
                      <button
                        type="button"
                        className="pos-cart-customer-detail-link"
                        onClick={() => {
                          const c = customers.find((x) => x.id === selectedPosCustomerId);
                          if (c) setCustomerDetailCustomer(c);
                        }}
                      >
                        Detay / duzenle · satis gecmisi
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="pos-cart-customer-footer-hint muted small">
                  Musteri secince satis kaydina yazilir; veresiye icin musteri secin veya yeni musteri ekleyin.
                </p>
              )}
            </div>
          </section>
          </div>
        </>
      )}

      {posPane === "ledger" && (
        <section className="products-panel pos-ledger-panel">
          <CustomersPanel
            layout="ledger"
            customers={customers}
            products={products}
            categories={categories}
            suppliers={suppliers}
            selectedCustomerId={selectedPosCustomerId}
            onSelectCustomer={setSelectedPosCustomerId}
            onCustomPricesChange={setCustomerCustomPricesByProduct}
            onOpenSaleDetail={(saleId) => void openSaleDetail(saleId)}
            onSuppliersChange={() => void onDataRefresh?.()}
            onCustomersChange={() => void refreshCustomers()}
          />
        </section>
      )}

      {posPane === "today" && (
        <section className="sales-summary today-sales-tab">
          <h2>Bugunun satislari</h2>
          <p className="sales-summary-date">{today}</p>
          <div className="sales-summary-totals">
            <div>
              <span className="sales-summary-label">Islem sayisi</span>
              <span className="sales-summary-value">{salesSummary.count}</span>
            </div>
            <div>
              <span className="sales-summary-label">Nakit toplam</span>
              <span className="sales-amount">{formatTry(salesSummary.cashKurus)}</span>
            </div>
            <div>
              <span className="sales-summary-label">Kart toplam</span>
              <span className="sales-amount">{formatTry(salesSummary.cardKurus)}</span>
            </div>
            <div
              className={`sales-summary-gross sales-summary-ciro-row${showCiroAmounts ? " is-revealed" : ""}`}
              onMouseEnter={() => setCiroHover(true)}
              onMouseLeave={() => setCiroHover(false)}
              onClick={() => setCiroPinned((p) => !p)}
              title="Gunluk ciro: gostermek icin uzerine gelin veya tiklayin"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setCiroPinned((p) => !p);
                }
              }}
            >
              <p className="sales-summary-ciro-hint">
                {showCiroAmounts ? "Tiklama ile sabitleyebilirsiniz" : "Gunluk ciro gizli — uzerine gelin veya tiklayin"}
              </p>
              <div className="sales-summary-gross-inner">
                <span className="sales-summary-label">Gunluk ciro</span>
                <span className="sales-amount sales-amount-lg">
                  {maskCiroAmount(showCiroAmounts, formatTry(salesSummary.grossKurus))}
                </span>
              </div>
            </div>
          </div>
          <h3 className="recent-sales-title">
            Tum islemler ({filteredDailySales.length}
            {filteredDailySales.length !== dailySales.length ? ` / ${dailySales.length}` : ""})
          </h3>
          <p className="closure-help small">Satira tiklayin; sepet icerigi ve iade icin detay penceresini kullanin.</p>
          {dailySales.length > 0 ? (
          <>
          <div className="today-sales-toolbar" role="search">
            <label className="today-sales-field">
              <span>Islem</span>
              <select value={todayListKind} onChange={(e) => setTodayListKind(e.target.value as "all" | SaleKind)}>
                <option value="all">Tumu</option>
                <option value="sale">Satis</option>
                <option value="debt_payment">Borc odemesi</option>
                <option value="return">Iade</option>
              </select>
            </label>
            <label className="today-sales-field">
              <span>Odeme</span>
              <select value={todayListPayment} onChange={(e) => setTodayListPayment(e.target.value as "all" | PaymentType)}>
                <option value="all">Tumu</option>
                <option value="cash">Nakit</option>
                <option value="card">Kart</option>
              </select>
            </label>
            <label className="today-sales-field today-sales-field-grow">
              <span>Musteri</span>
              <select value={todayListCustomerKey} onChange={(e) => setTodayListCustomerKey(e.target.value)}>
                <option value="">Tumu</option>
                <option value="none">Musterisiz</option>
                {todaySaleCustomerIds.map((cid) => {
                  const c = customers.find((x) => x.id === cid);
                  return (
                    <option key={cid} value={String(cid)}>
                      {c?.name?.trim() ? c.name.trim() : `Musteri #${cid}`}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="today-sales-field today-sales-field-grow">
              <span>Ara</span>
              <input
                type="search"
                placeholder="#islem no veya sepet adi"
                value={todayListQuery}
                onChange={(e) => setTodayListQuery(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="today-sales-field">
              <span>Sirala</span>
              <select value={todayListSort} onChange={(e) => setTodayListSort(e.target.value as typeof todayListSort)}>
                <option value="time_desc">Saat (yeni once)</option>
                <option value="time_asc">Saat (eski once)</option>
                <option value="amount_desc">Tutar (buyukten kucuge)</option>
                <option value="amount_asc">Tutar (kucukten buyuge)</option>
              </select>
            </label>
            <label className="today-sales-field">
              <span>Satis birimi</span>
              <select
                value={todayListSaleUnitFilter}
                onChange={(e) => {
                  setTodayListSaleUnitFilter(e.target.value as PosCatalogUnitFilter);
                  setTodayListCategoryId(0);
                }}
              >
                <option value="all">Tumu</option>
                <option value="piece">Adet</option>
                <option value="gram">Gramajli</option>
              </select>
            </label>
            <label className="today-sales-field today-sales-field-grow">
              <span>Kategori</span>
              <select
                value={todayListCategoryId}
                disabled={todayListSaleUnitFilter === "all"}
                onChange={(e) => setTodayListCategoryId(Number(e.target.value))}
              >
                <option value={0}>
                  {todayListSaleUnitFilter === "all" ? "Once satis birimi secin" : "Bu gruptaki tumu"}
                </option>
                {todayCategoriesForUnit.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          </>
          ) : null}
          <div className="sales-summary-list today-sales-full-list">
            {dailySales.length === 0 && <p className="sales-summary-empty">Bugun henuz islem yok.</p>}
            {dailySales.length > 0 && filteredDailySales.length === 0 && (
              <p className="sales-summary-empty">Filtreye uyan islem yok.</p>
            )}
            {filteredDailySales.map((sale) => (
              <button
                type="button"
                key={sale.id}
                className="sales-summary-row sales-summary-row-button"
                onClick={() => void openSaleDetail(sale.id)}
              >
                <span className="sales-summary-time">
                  #{sale.id} · {formatSaleTime(sale.createdAt)} · {sale.cartName || "Sepet"}
                </span>
                <span className="sales-summary-pay">
                  {saleKindListLabel(sale.kind)} · {sale.paymentType === "cash" ? "Nakit" : "Kart"}
                  {sale.kind === "debt_payment" && sale.customerId
                    ? ` · ${customers.find((c) => c.id === sale.customerId)?.name ?? `Musteri #${sale.customerId}`}`
                    : null}
                </span>
                <span className="sales-amount">{formatTry(saleCollectedKurus(sale))}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {editProduct && (
        <div
          className="modal-backdrop"
          onMouseDown={() => {
            setEditProduct(null);
            setEditForm(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog product-edit-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <div className="product-edit-head">
              <h3>Urun duzenle</h3>
              <button
                type="button"
                onClick={() => {
                  setEditProduct(null);
                  setEditForm(null);
                }}
              >
                Kapat
              </button>
            </div>
            <p className="product-edit-subtitle">{editProduct.name}</p>
            {editForm && (
              <div className="product-edit-grid">
                <label className="settings-field product-edit-field">
                  <span>Urun adi</span>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                    placeholder="Urun adi"
                  />
                </label>
                <label className="settings-field product-edit-field">
                  <span>Kategori</span>
                  <select
                    value={editForm.categoryId}
                    onChange={(e) => setEditForm((prev) => (prev ? { ...prev, categoryId: Number(e.target.value) } : prev))}
                  >
                    <option value={0}>Kategori sec</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="settings-field product-edit-field">
                  <span>Tedarikci</span>
                  <select
                    value={editForm.supplierId}
                    onChange={(e) => setEditForm((prev) => (prev ? { ...prev, supplierId: Number(e.target.value) } : prev))}
                  >
                    <option value={0}>Tedarikci yok</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="settings-field product-edit-field">
                  <span>Barkod</span>
                  <input
                    type="text"
                    value={editForm.barcode}
                    onChange={(e) => setEditForm((prev) => (prev ? { ...prev, barcode: e.target.value } : prev))}
                    placeholder="Barkod"
                  />
                </label>
                <label className="settings-field product-edit-field">
                  <span>Kod</span>
                  <input
                    type="text"
                    value={editForm.code}
                    onChange={(e) => setEditForm((prev) => (prev ? { ...prev, code: e.target.value } : prev))}
                    placeholder="Kod"
                  />
                </label>
                <div className="settings-field product-edit-field product-edit-stock-wrap">
                  <label>
                    <span>{categorySaleUnitOf(categories, editForm.categoryId) === "gram" ? "Stok (gram, tam sayi)" : "Stok"}</span>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={editForm.stockQty}
                      onChange={(e) => {
                        const v = e.target.value;
                        setEditForm((prev) => {
                          if (!prev) return prev;
                          if (v === "") return { ...prev, stockQty: "" };
                          const isGram = categorySaleUnitOf(categories, prev.categoryId) === "gram";
                          return { ...prev, stockQty: isGram ? String(Math.max(0, Math.round(Number(v) || 0))) : v };
                        });
                      }}
                      placeholder="Stok"
                    />
                  </label>
                  <p className="form-note product-edit-stock-hint">
                    Yeni gelen malin stok artisi icin bu alani kullanmayin.{" "}
                    <strong>Stok → Stok ekle</strong> bolumunden giris yapin; tedarikci, maliyet ve gider kaydi orada
                    olusur. Buradaki stok alani sayim duzeltmesi veya guncel miktari gormek icindir.
                  </p>
                </div>
                <label className="settings-field product-edit-field">
                  <span>
                    {categorySaleUnitOf(categories, editForm.categoryId) === "gram" ? "Satis fiyati (TL / 1000 g)" : "Satis fiyati (TL)"}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.priceTl}
                    onChange={(e) => setEditForm((prev) => (prev ? { ...prev, priceTl: e.target.value } : prev))}
                    placeholder="0.00"
                  />
                </label>
                <h3 className="product-edit-subheading settings-field-wide">Toptan satis</h3>
                <label className="settings-field settings-field-wide product-edit-field product-edit-checkbox">
                  <span>Toptan satisa acik</span>
                  <input
                    type="checkbox"
                    checked={editForm.sellsWholesale}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              sellsWholesale: e.target.checked,
                              wholesaleTl: e.target.checked ? prev.wholesaleTl : ""
                            }
                          : prev
                      )
                    }
                  />
                </label>
                {editForm.sellsWholesale ? (
                  <>
                    <p className="form-note settings-field-wide product-edit-section-note">
                      {categorySaleUnitOf(categories, editForm.categoryId) === "gram"
                        ? "Sepette Toptan seciliyken bu TL / 1000 g birim fiyat uygulanir. Bos birakilirsa perakende / 1000 g kullanilir."
                        : "Sepette Toptan seciliyken bu birim fiyat uygulanir. Bos birakilirsa perakende fiyat kullanilir."}
                    </p>
                    <label className="settings-field product-edit-field">
                      <span>{wholesalePricePlaceholder(categorySaleUnitOf(categories, editForm.categoryId))}</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={editForm.wholesaleTl}
                        onChange={(e) => setEditForm((prev) => (prev ? { ...prev, wholesaleTl: e.target.value } : prev))}
                        placeholder="0.00"
                      />
                    </label>
                  </>
                ) : null}
                <h3 className="product-edit-subheading settings-field-wide">Kart ile odeme</h3>
                <p className="form-note settings-field-wide product-edit-section-note">
                  Sepette odeme Kart seciliyken bu birim fiyat uygulanir; bos birakilirsa liste (nakit) fiyati kullanilir.
                </p>
                <label className="settings-field product-edit-field">
                  <span>
                    {categorySaleUnitOf(categories, editForm.categoryId) === "gram" ? "Kart fiyati (TL / 1000 g)" : "Kart fiyati (TL)"}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={editForm.alternateTl}
                    onChange={(e) => setEditForm((prev) => (prev ? { ...prev, alternateTl: e.target.value } : prev))}
                    placeholder="Kart odemede; bos birakilirsa liste fiyati"
                  />
                </label>
                <label className="settings-field settings-field-wide product-edit-field product-edit-checkbox">
                  <span>Favori satis (POS ust serit)</span>
                  <input
                    type="checkbox"
                    checked={editForm.posFavorite}
                    onChange={(e) => setEditForm((prev) => (prev ? { ...prev, posFavorite: e.target.checked } : prev))}
                  />
                </label>
                <label className="settings-field product-edit-field">
                  <span>Indirim (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={editForm.discountPercent}
                    onChange={(e) => setEditForm((prev) => (prev ? { ...prev, discountPercent: e.target.value } : prev))}
                    placeholder="0"
                  />
                </label>
                <label className="settings-field product-edit-field">
                  <span>
                    {categorySaleUnitOf(categories, editForm.categoryId) === "gram"
                      ? "Gelis / maliyet (TL / 1000 g)"
                      : "Maliyet (TL)"}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={editForm.costTl}
                    onChange={(e) => setEditForm((prev) => (prev ? { ...prev, costTl: e.target.value } : prev))}
                    placeholder="0.00"
                  />
                </label>
                <label className="settings-field product-edit-field">
                  <span>KDV (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="1"
                    value={editForm.vatRatePercent}
                    onChange={(e) => setEditForm((prev) => (prev ? { ...prev, vatRatePercent: e.target.value } : prev))}
                    placeholder="20"
                  />
                </label>
                <label className="settings-field settings-field-wide product-edit-field">
                  <span>Aciklama</span>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
                    rows={3}
                    placeholder="Urun aciklamasi"
                  />
                </label>
                <label className="settings-field settings-field-wide product-edit-field">
                  <span>Malzeme / not</span>
                  <input
                    value={editForm.material}
                    onChange={(e) => setEditForm((prev) => (prev ? { ...prev, material: e.target.value } : prev))}
                    placeholder="Malzeme / not"
                  />
                </label>
                <label className="settings-field settings-field-wide product-edit-field">
                  <span>Resim yolu</span>
                  <div className="image-input-row product-edit-image-row">
                    <input
                      value={editForm.imagePath}
                      onChange={(e) => setEditForm((prev) => (prev ? { ...prev, imagePath: e.target.value } : prev))}
                      placeholder="Resim yolu"
                    />
                    <button type="button" onClick={() => void pickEditImage()}>
                      Resim Sec
                    </button>
                    <button type="button" onClick={() => setEditForm((prev) => (prev ? { ...prev, imagePath: "" } : prev))}>
                      Temizle
                    </button>
                  </div>
                  {mediaDir ? <small className="product-edit-media-note">Resimler otomatik kaydedilir: {mediaDir}</small> : null}
                </label>
                <div className="sale-unit-row settings-field-wide">
                  <label className="sale-unit-option">
                    <input
                      type="checkbox"
                      checked={editForm.priceIncludesVat}
                      onChange={(e) => setEditForm((prev) => (prev ? { ...prev, priceIncludesVat: e.target.checked } : prev))}
                    />
                    Fiyat KDV dahil
                  </label>
                  <label className="sale-unit-option">
                    <input
                      type="checkbox"
                      checked={editForm.domesticMade}
                      onChange={(e) => setEditForm((prev) => (prev ? { ...prev, domesticMade: e.target.checked } : prev))}
                    />
                    Yerli uretim
                  </label>
                </div>
                <div className="product-edit-preview">
                  {editForm.imagePath.trim() ? (
                    <img
                      src={imageSrcMap[editForm.imagePath.trim()] || resolveImageSrc(editForm.imagePath.trim())}
                      alt={editForm.name || editProduct.name}
                    />
                  ) : (
                    <span>Resim secilmedi</span>
                  )}
                </div>
              </div>
            )}
            <div className="modal-actions">
              <button
                type="button"
                onClick={() => {
                  setEditProduct(null);
                  setEditForm(null);
                }}
              >
                Vazgec
              </button>
              <button type="button" className="primary" onClick={() => void saveProductEdit()}>
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {invoicePreviewOpen && (
        <div className="settings-log-overlay" onClick={() => setInvoicePreviewOpen(false)} role="dialog" aria-modal="true">
          <div className="settings-log-dialog invoice-preview-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="settings-card-head">
              <h3>Fatura Onizleme</h3>
              <div className="settings-card-actions">
                <button type="button" onClick={() => void dialCustomer()} disabled={!invoiceCustomer.phone?.trim()}>
                  Telefonla ara
                </button>
                <button type="button" onClick={() => void createInvoice()}>
                  HTML Kaydet
                </button>
                <button type="button" disabled={invoiceLoading || !invoicePreviewHtml} onClick={() => printInvoicePreview()}>
                  Yazdir
                </button>
                <button type="button" onClick={() => setInvoicePreviewOpen(false)}>
                  Kapat
                </button>
              </div>
            </div>
            {invoiceLoading ? (
              <p className="settings-empty">Fatura hazirlaniyor...</p>
            ) : (
              <>
                <div className="settings-company-grid invoice-customer-grid">
                  {customerField("companyName", "Firma / unvan (tedarikci)", "Orn: ABC Ltd. Sti.")}
                  {customerField("fullName", "Ad soyad / yetkili", "Orn: Ahmet Yilmaz")}
                  {customerField("tcOrVkn", "TC / VKN", "Bos birakilirsa 11111111111")}
                  {customerField("phone", "Telefon", "Orn: +90 5xx xxx xx xx")}
                  {customerField("email", "E-Posta", "Bos birakilirsa Belirtilmedi")}
                  {customerField("district", "Ilce", "Orn: Karsiyaka")}
                  {customerField("city", "Il", "Orn: Izmir")}
                  <label className="settings-field settings-field-wide">
                    <span>Adres</span>
                    <input
                      value={invoiceCustomer.address ?? ""}
                      placeholder="Musteri adresi"
                      onChange={(e) => setInvoiceCustomer((p) => ({ ...p, address: e.target.value }))}
                    />
                  </label>
                </div>
                <button type="button" onClick={() => void openInvoicePreview()}>
                  Onizlemeyi Guncelle
                </button>
                <iframe ref={invoiceFrameRef} title="Fatura onizleme" className="invoice-preview-frame" srcDoc={invoicePreviewHtml} />
              </>
            )}
          </div>
        </div>
      )}

      {detailOpen && (
        <div className="settings-log-overlay" onClick={() => setDetailOpen(null)} role="dialog" aria-modal="true">
          <div className="settings-log-dialog sale-detail-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="settings-card-head">
              <h3>
                Islem #{detailOpen.sale.id} · {saleKindListLabel(detailOpen.sale.kind)}
              </h3>
              <button type="button" onClick={() => setDetailOpen(null)}>
                Kapat
              </button>
            </div>
            <p className="sale-detail-meta">
              {formatSaleTime(detailOpen.sale.createdAt)} · {detailOpen.sale.paymentType === "cash" ? "Nakit" : "Kart"} · Sepet:{" "}
              {detailOpen.sale.cartName || "Sepet 1"}
              {detailOpen.sale.customerId ? (
                <>
                  {" "}
                  · Musteri: {customers.find((c) => c.id === detailOpen.sale.customerId)?.name ?? `#${detailOpen.sale.customerId}`}
                </>
              ) : null}
            </p>
            {detailOpen.sale.kind === "debt_payment" ? (
              <p className="sale-detail-meta">
                Musteri borcu tahsilati — kasaya giren:{" "}
                <strong className="sales-amount">{formatTry(saleCollectedKurus(detailOpen.sale))}</strong>
              </p>
            ) : (
              <div className="sale-detail-table-wrap">
                <table className="sale-detail-table">
                  <thead>
                    <tr>
                      <th>Kod</th>
                      <th>Urun</th>
                      <th className="r">Miktar</th>
                      <th className="r">Birim</th>
                      <th className="r">Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailOpen.items.map((ln) => (
                      <tr key={ln.saleItemId ?? `${ln.productId}-${ln.qty}-${ln.unitPriceKurus}`}>
                        <td className="sale-detail-code">{ln.productCode || "—"}</td>
                        <td>{ln.productName}</td>
                        <td className="r">{formatQtyShort(ln.qty, ln.saleUnit)}</td>
                        <td className="r">
                          {formatPosUnitPrice(
                            ln.unitPriceKurus,
                            categories,
                            products.find((p) => p.id === ln.productId)?.categoryId ?? 0
                          )}
                        </td>
                        <td className="r sales-amount">{formatTry(ln.lineTotalKurus)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="sale-detail-total">
              <strong>
                {detailOpen.sale.kind === "debt_payment"
                  ? `Tahsilat: ${formatTry(saleCollectedKurus(detailOpen.sale))}`
                  : `Toplam: ${formatTry(detailOpen.sale.subtotalKurus)}`}
              </strong>
              {(detailOpen.sale.debtPaidKurus ?? 0) > 0 && detailOpen.sale.kind === "sale" ? (
                <span className="sale-detail-debt"> · Borca odeme: {formatTry(detailOpen.sale.debtPaidKurus!)}</span>
              ) : null}
              {detailOpen.sale.kind === "sale" && detailOpen.sale.paymentType === "cash" ? (
                <>
                  {" "}
                  · Alinan: {formatTry(detailOpen.sale.paidAmountKurus)}
                  {(detailOpen.sale.debtAddedKurus ?? 0) > 0 ? (
                    <span className="sale-detail-debt"> · Borc eklendi: {formatTry(detailOpen.sale.debtAddedKurus!)}</span>
                  ) : null}
                  {detailOpen.sale.changeAmountKurus > 0 ? (
                    <> · Para ustu: {formatTry(detailOpen.sale.changeAmountKurus)}</>
                  ) : null}
                </>
              ) : null}
            </p>
            <div className="sale-detail-actions">
              {detailOpen.sale.kind === "sale" ? (
                <button type="button" className="sale-detail-return-btn" onClick={() => void applyReturnFromDetail()}>
                  Iade icin sepete al (Satis sekmesi)
                </button>
              ) : (
                <p className="sale-detail-return-hint">Bu kayit zaten iade; yeni iade icin orijinal satisi secin.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {productContext ? (
        <ul
          className="stock-context-menu"
          style={{ left: productContext.x, top: productContext.y }}
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
                openEditModal(productContext.product);
              }}
            >
              Urun duzenle
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setProductContext(null);
                setPosAdjustProduct(productContext.product);
              }}
            >
              Sayim / stok duzelt
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setProductContext(null);
                setPosReceiveProduct(productContext.product);
              }}
            >
              Stok gelen
            </button>
          </li>
        </ul>
      ) : null}
      {posReceiveProduct ? (
        <ReceiveStockModal
          product={products.find((p) => p.id === posReceiveProduct.id) ?? posReceiveProduct}
          categories={categories}
          suppliers={suppliers}
          onClose={() => setPosReceiveProduct(null)}
          onSaved={refreshPosCatalog}
        />
      ) : null}
      {posAdjustProduct ? (
        <StockAdjustModal
          product={products.find((p) => p.id === posAdjustProduct.id) ?? posAdjustProduct}
          categories={categories}
          suppliers={suppliers}
          onClose={() => setPosAdjustProduct(null)}
          onSaved={refreshPosCatalog}
        />
      ) : null}
      {addCustomerOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setAddCustomerOpen(false)}>
          <div
            className={`modal-dialog ${addCustomerKind === "wholesale" ? "supplier-edit-dialog" : "customer-add-dialog"}`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3>Yeni {customerAddKindLabel(addCustomerKind)}</h3>
            <div className="payment-segment customer-add-kind-segment">
              <button
                type="button"
                className={addCustomerKind === "retail_regular" ? "active" : ""}
                onClick={() => setAddCustomerKind("retail_regular")}
              >
                Perakende
              </button>
              <button
                type="button"
                className={addCustomerKind === "wholesale" ? "active" : ""}
                onClick={() => setAddCustomerKind("wholesale")}
              >
                Kafe
              </button>
            </div>
            {addCustomerKind === "retail_regular" ? (
              <>
                <label className="settings-field">
                  <span>Ad soyad</span>
                  <input
                    value={addCustomerForm.name}
                    onChange={(e) => setAddCustomerForm((p) => ({ ...p, name: e.target.value }))}
                    autoFocus
                  />
                </label>
                <label className="settings-field">
                  <span>Telefon</span>
                  <input value={addCustomerForm.phone} onChange={(e) => setAddCustomerForm((p) => ({ ...p, phone: e.target.value }))} />
                </label>
              </>
            ) : (
              renderSupplierLikeForm(posAddCustomerAsContact(), patchPosAddCustomerForm, false, {
                nameLabel: "Kafe adi *",
                balanceLabel: "Bize borc (TL)",
                autoFocus: true
              })
            )}
            <p className="muted small">Kaydettikten sonra musteri sepette otomatik secilir; borc takibi acilir.</p>
            <div className="modal-actions">
              <button type="button" onClick={() => setAddCustomerOpen(false)}>
                Vazgec
              </button>
              <button type="button" className="primary" onClick={() => void submitAddCustomer()}>
                Kaydet ve sepete bagla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
