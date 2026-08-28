import { useCallback, useEffect, useMemo, useState } from "react";
import { getMarinaApi } from "../../api/marinaClient";
import type { Category, Customer, PaymentType, Product, SaleKind, SaleRecord, SaleWithLines } from "../../types/models";
import { formatTry } from "../../utils/currency";
import { saleCollectedKurus, saleKindListLabel } from "../../utils/saleCollected";
import { salePaymentLabel } from "../../utils/paymentLabel";
import { formatSaleDateTime } from "../../utils/saleFormat";
import { saleMatchesCatalogFilter, type SaleCatalogUnitFilter } from "../../utils/saleListFilter";
import { SaleDetailDialog } from "./SaleDetailDialog";

type Props = {
  products: Product[];
  categories: Category[];
  /** Sekme acikken veriyi yeniden yukler */
  active?: boolean;
  onStartReturnFromSale?: (saleId: number) => void;
};

type SortKey = "time_desc" | "time_asc" | "amount_desc" | "amount_asc";

export function SalesHistoryPanel({ products, categories, active = true, onStartReturnFromSale }: Props) {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [productIdsBySale, setProductIdsBySale] = useState<Record<number, number[]>>({});
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState<SaleWithLines | null>(null);

  const [listKind, setListKind] = useState<"all" | SaleKind>("all");
  const [listPayment, setListPayment] = useState<"all" | PaymentType>("all");
  const [listCustomerKey, setListCustomerKey] = useState("");
  const [listSaleUnitFilter, setListSaleUnitFilter] = useState<SaleCatalogUnitFilter>("all");
  const [listCategoryId, setListCategoryId] = useState(0);
  const [listQuery, setListQuery] = useState("");
  const [listSort, setListSort] = useState<SortKey>("time_desc");

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const api = getMarinaApi();
      const [history, cust] = await Promise.all([api.listSalesHistory(0), api.listCustomers()]);
      setSales(history.sales ?? []);
      setProductIdsBySale(history.productIdsBySale ?? {});
      setCustomers(Array.isArray(cust) ? cust : []);
    } catch {
      setSales([]);
      setProductIdsBySale({});
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) void loadHistory();
  }, [loadHistory, active]);

  const saleCustomerIds = useMemo(() => {
    const s = new Set<number>();
    for (const r of sales) {
      const cid = r.customerId;
      if (cid != null && cid > 0) s.add(cid);
    }
    return Array.from(s).sort((a, b) => a - b);
  }, [sales]);

  const categoriesForUnit = useMemo(() => {
    if (listSaleUnitFilter === "all") return [];
    return categories.filter((c) => c.saleUnit === listSaleUnitFilter);
  }, [categories, listSaleUnitFilter]);

  const filteredSales = useMemo(() => {
    const qRaw = listQuery.trim().toLowerCase();
    const qn = qRaw.replace(/^#/, "").replace(/\s+/g, "");
    const rows = sales.filter((sale) => {
      if (listKind !== "all" && sale.kind !== listKind) return false;
      if (listPayment !== "all" && sale.paymentType !== listPayment) return false;
      if (listCustomerKey === "none") {
        const cid = sale.customerId;
        if (cid != null && cid > 0) return false;
      } else if (listCustomerKey !== "") {
        const want = Number(listCustomerKey);
        if (!Number.isFinite(want) || sale.customerId !== want) return false;
      }
      if (qRaw) {
        const idStr = String(sale.id);
        const cart = (sale.cartName || "").toLowerCase();
        const cust = sale.customerId
          ? (customers.find((c) => c.id === sale.customerId)?.name ?? "").toLowerCase()
          : "";
        const matchesId = qn !== "" && idStr.includes(qn);
        const matchesCart = cart.includes(qRaw);
        const matchesCustomer = cust.includes(qRaw);
        if (!matchesId && !matchesCart && !matchesCustomer) return false;
      }
      if (
        sale.kind === "sale" &&
        !saleMatchesCatalogFilter(sale.id, productIdsBySale, products, categories, listSaleUnitFilter, listCategoryId)
      ) {
        return false;
      }
      return true;
    });
    const cmp = (a: SaleRecord, b: SaleRecord) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      switch (listSort) {
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
    sales,
    productIdsBySale,
    products,
    categories,
    customers,
    listKind,
    listPayment,
    listCustomerKey,
    listSaleUnitFilter,
    listCategoryId,
    listQuery,
    listSort
  ]);

  const openSaleDetail = async (saleId: number) => {
    const row = await getMarinaApi().getSaleWithLines(saleId);
    if (row) setDetailOpen(row);
  };

  const customerLabel = (sale: SaleRecord) => {
    const cid = sale.customerId;
    if (cid == null || cid <= 0) return null;
    return customers.find((c) => c.id === cid)?.name ?? `Musteri #${cid}`;
  };

  return (
    <section className="stock-panel-list stock-panel-tab-panel stock-panel-sales-history">
      <div className="stock-panel-list-top">
        <h2 className="visually-hidden">Satis gecmisi</h2>
        <p className="stock-help small">
          Tum satislar (Sepet 1, Sepet 2, musterili / musterisiz, borc odemesi, iade) en yeni ustte.{" "}
          <strong>Satira tiklayin</strong>; sepet icerigi ve iade icin detay penceresini kullanin.
        </p>
        <div className="stock-sales-history-head-row">
          <p className="stock-help small muted">
            {loading
              ? "Yukleniyor..."
              : `${filteredSales.length}${filteredSales.length !== sales.length ? ` / ${sales.length}` : ""} islem · ${sales.length} kayit`}
          </p>
          <button type="button" className="linkish" disabled={loading} onClick={() => void loadHistory()}>
            Yenile
          </button>
        </div>
      </div>
      {sales.length > 0 ? (
        <div className="today-sales-toolbar stock-sales-history-toolbar" role="search">
          <label className="today-sales-field">
            <span>Islem</span>
            <select value={listKind} onChange={(e) => setListKind(e.target.value as "all" | SaleKind)}>
              <option value="all">Tumu</option>
              <option value="sale">Satis</option>
              <option value="debt_payment">Borc odemesi</option>
              <option value="return">Iade</option>
            </select>
          </label>
          <label className="today-sales-field">
            <span>Odeme</span>
            <select value={listPayment} onChange={(e) => setListPayment(e.target.value as "all" | PaymentType)}>
              <option value="all">Tumu</option>
              <option value="cash">Nakit</option>
              <option value="card">Kart</option>
              <option value="mixed">Karma</option>
            </select>
          </label>
          <label className="today-sales-field today-sales-field-grow">
            <span>Musteri</span>
            <select value={listCustomerKey} onChange={(e) => setListCustomerKey(e.target.value)}>
              <option value="">Tumu</option>
              <option value="none">Musterisiz</option>
              {saleCustomerIds.map((cid) => {
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
              placeholder="#islem, musteri veya sepet"
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="today-sales-field">
            <span>Sirala</span>
            <select value={listSort} onChange={(e) => setListSort(e.target.value as SortKey)}>
              <option value="time_desc">Tarih (yeni once)</option>
              <option value="time_asc">Tarih (eski once)</option>
              <option value="amount_desc">Tutar (buyukten kucuge)</option>
              <option value="amount_asc">Tutar (kucukten buyuge)</option>
            </select>
          </label>
          <label className="today-sales-field">
            <span>Satis birimi</span>
            <select
              value={listSaleUnitFilter}
              onChange={(e) => {
                setListSaleUnitFilter(e.target.value as SaleCatalogUnitFilter);
                setListCategoryId(0);
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
              value={listCategoryId}
              disabled={listSaleUnitFilter === "all"}
              onChange={(e) => setListCategoryId(Number(e.target.value))}
            >
              <option value={0}>
                {listSaleUnitFilter === "all" ? "Once satis birimi secin" : "Bu gruptaki tumu"}
              </option>
              {categoriesForUnit.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      <div className="stock-scroll-body stock-scroll-body--list">
        <div className="sales-summary-list today-sales-full-list stock-sales-history-list">
          {!loading && sales.length === 0 && <p className="sales-summary-empty">Henuz satis kaydi yok.</p>}
          {!loading && sales.length > 0 && filteredSales.length === 0 && (
            <p className="sales-summary-empty">Filtreye uyan islem yok.</p>
          )}
          {filteredSales.map((sale) => {
            const cust = customerLabel(sale);
            return (
              <button
                type="button"
                key={sale.id}
                className="sales-summary-row sales-summary-row-button"
                onClick={() => void openSaleDetail(sale.id)}
              >
                <span className="sales-summary-time">
                  #{sale.id} · {formatSaleDateTime(sale.createdAt)} · {sale.cartName || "Sepet"}
                  {cust ? ` · ${cust}` : ""}
                </span>
                <span className="sales-summary-pay">
                  {saleKindListLabel(sale.kind)} · {salePaymentLabel(sale.paymentType)}
                  {sale.paymentType === "mixed" && (sale.cashAmountKurus != null || sale.cardAmountKurus != null)
                    ? ` (${formatTry(sale.cashAmountKurus ?? 0)} nakit + ${formatTry(sale.cardAmountKurus ?? 0)} kart)`
                    : null}
                  {sale.paymentNote?.trim() ? ` · ${sale.paymentNote.trim()}` : null}
                </span>
                <span className="sales-amount">{formatTry(saleCollectedKurus(sale))}</span>
              </button>
            );
          })}
        </div>
      </div>
      <SaleDetailDialog
        detail={detailOpen}
        customers={customers}
        products={products}
        categories={categories}
        onClose={() => setDetailOpen(null)}
        onApplyReturn={
          detailOpen?.sale.kind === "sale" && onStartReturnFromSale
            ? () => {
                onStartReturnFromSale(detailOpen.sale.id);
                setDetailOpen(null);
              }
            : undefined
        }
      />
    </section>
  );
}
