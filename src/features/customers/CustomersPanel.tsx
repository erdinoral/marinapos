import { useCallback, useEffect, useMemo, useState } from "react";
import { getMarinaApi } from "../../api/marinaClient";
import type {
  Category,
  Customer,
  CustomerInput,
  CustomerKind,
  CustomerProductPrice,
  CustomerPurchaseRow,
  CustomerStats,
  Product,
  SaleWithLines,
  StockEntryLogRow,
  PaymentType,
  Supplier,
  SupplierInput,
  SupplierOverview
} from "../../types/models";
import { formatTry, parseTrAmount, tlToKurus } from "../../utils/currency";
import { customerAddKindLabel, customerKindLabel, customerKindShort } from "../../utils/customerLabels";
import {
  type ContactFormShape,
  renderSupplierLikeForm,
  supplierInputFromForm
} from "./customerContactForm";
import { customersWithDebtByKind } from "../../utils/customerDebt";
import { suppliersWithDebt } from "../../utils/supplierDebt";
import { categorySaleUnitOf, formatQtyShort, kurusPerGramToTlPer1000g, tlPer1000gToKurusPerGram } from "../../utils/saleUnit";

type DetailTab = "info" | "prices" | "history";
type Selection = { type: "customer"; id: number } | { type: "supplier"; id: number } | null;
export type CustomersPanelColumn = "retail" | "wholesale" | "supplier";

function matchesSearch(hay: string, q: string) {
  return !q || hay.toLowerCase().includes(q);
}

function customerHaystack(c: Customer) {
  return [c.name, c.phone, c.email, c.companyName, c.address, c.note, c.taxOrVkn, c.city, c.district].join(" ");
}

function supplierHaystack(s: Supplier) {
  return [s.name, s.phone, s.email, s.address, s.note, s.taxOffice, s.taxNumber, s.city, s.district].join(" ");
}

function customerDebtLabel(c: Customer) {
  return c.kind === "wholesale" && c.companyName.trim() ? `${c.companyName.trim()} · ${c.name}` : c.name;
}

function formatSaleTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return d.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

function unitPriceLabel(categories: Category[], product: Product, kurus: number) {
  const unit = categorySaleUnitOf(categories, product.categoryId);
  return unit === "gram" ? `${kurusPerGramToTlPer1000g(kurus)} / 1000 g` : formatTry(kurus);
}

function stockEntryUnitCostLabel(entry: Pick<StockEntryLogRow, "unitCostKurus" | "saleUnit">): string {
  if (entry.unitCostKurus == null || entry.unitCostKurus <= 0) return "—";
  if (entry.saleUnit === "gram") return `${kurusPerGramToTlPer1000g(entry.unitCostKurus)} / 1000 g`;
  return `${formatTry(entry.unitCostKurus)} / adet`;
}

interface Props {
  /** Tek sutun (eski POS modlari) veya 3 sutunlu kayit defteri */
  layout?: "single" | "ledger";
  column?: CustomersPanelColumn;
  customers: Customer[];
  products: Product[];
  categories: Category[];
  suppliers: Supplier[];
  selectedCustomerId: number | null;
  onSelectCustomer: (id: number | null) => void;
  onCustomPricesChange: (map: Record<number, number>) => void;
  onOpenSaleDetail: (saleId: number) => void;
  onSuppliersChange?: () => void;
  onCustomersChange?: () => void;
}

export function CustomersPanel({
  layout = "single",
  column = "retail",
  customers,
  products,
  categories,
  suppliers,
  selectedCustomerId,
  onSelectCustomer,
  onCustomPricesChange,
  onOpenSaleDetail,
  onSuppliersChange,
  onCustomersChange
}: Props) {
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<Selection>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("info");

  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null);
  const [recentSales, setRecentSales] = useState<SaleWithLines[]>([]);
  const [purchaseRows, setPurchaseRows] = useState<CustomerPurchaseRow[]>([]);
  const [detailSales, setDetailSales] = useState<SaleWithLines[]>([]);
  const [detailSalesLoading, setDetailSalesLoading] = useState(false);
  const [productPrices, setProductPrices] = useState<CustomerProductPrice[]>([]);
  const [supplierOverview, setSupplierOverview] = useState<SupplierOverview | null>(null);

  const [ledgerTab, setLedgerTab] = useState<CustomersPanelColumn>("retail");
  const [ledgerAddOpen, setLedgerAddOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addKind, setAddKind] = useState<CustomerKind>("retail_regular");
  const [ledgerAddSaving, setLedgerAddSaving] = useState(false);
  const [debtPaySaving, setDebtPaySaving] = useState(false);
  const [debtPayType, setDebtPayType] = useState<PaymentType>("cash");
  const [addForm, setAddForm] = useState({
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

  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [editForm, setEditForm] = useState({ ...addForm });
  const [editSaving, setEditSaving] = useState(false);

  const [addSupplierOpen, setAddSupplierOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    district: "",
    city: "",
    taxOffice: "",
    taxNumber: "",
    note: "",
    balanceTl: ""
  });
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);

  const [priceEdits, setPriceEdits] = useState<Record<number, string>>({});

  const q = search.trim().toLowerCase();

  useEffect(() => {
    if (layout === "ledger") return;
    setSelection(null);
    setDetailTab("info");
  }, [column, layout]);

  useEffect(() => {
    if (layout !== "ledger") return;
    setSelection(null);
    onSelectCustomer(null);
    setDetailTab("info");
    setLedgerAddOpen(false);
  }, [ledgerTab, layout, onSelectCustomer]);

  useEffect(() => {
    if (selectedCustomerId == null) {
      if (selection?.type === "customer") setSelection(null);
      return;
    }
    setSelection({ type: "customer", id: selectedCustomerId });
  }, [selectedCustomerId]);

  const retailCustomers = useMemo(
    () =>
      customers
        .filter((c) => c.kind === "retail_regular" && matchesSearch(customerHaystack(c), q))
        .sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [customers, q]
  );

  const wholesaleCustomers = useMemo(
    () =>
      customers
        .filter((c) => c.kind === "wholesale" && matchesSearch(customerHaystack(c), q))
        .sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [customers, q]
  );

  const filteredSuppliers = useMemo(
    () => suppliers.filter((s) => matchesSearch(supplierHaystack(s), q)).sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [suppliers, q]
  );

  const retailDebtors = useMemo(
    () => customersWithDebtByKind(customers, "retail_regular").filter((c) => matchesSearch(customerHaystack(c), q)),
    [customers, q]
  );
  const wholesaleDebtors = useMemo(
    () => customersWithDebtByKind(customers, "wholesale").filter((c) => matchesSearch(customerHaystack(c), q)),
    [customers, q]
  );
  const suppliersWithDebtFiltered = useMemo(
    () => suppliersWithDebt(suppliers).filter((s) => matchesSearch(supplierHaystack(s), q)),
    [suppliers, q]
  );

  const selectedCustomer = useMemo(
    () => (selection?.type === "customer" ? customers.find((c) => c.id === selection.id) ?? null : null),
    [selection, customers]
  );

  const selectedSupplier = useMemo(
    () => (selection?.type === "supplier" ? suppliers.find((s) => s.id === selection.id) ?? null : null),
    [selection, suppliers]
  );

  const loadCustomerDetail = useCallback(async (customerId: number) => {
    const api = getMarinaApi();
    const [st, sales, purchases, prices] = await Promise.all([
      api.getCustomerStats(customerId),
      api.getSalesForCustomer(customerId, 14),
      api.getCustomerPurchaseSummary(customerId),
      api.listCustomerProductPrices(customerId)
    ]);
    setCustomerStats(st);
    setRecentSales(Array.isArray(sales) ? sales : []);
    setPurchaseRows(Array.isArray(purchases) ? purchases : []);
    setProductPrices(Array.isArray(prices) ? prices : []);
    const map: Record<number, number> = {};
    for (const p of prices ?? []) map[p.productId] = p.priceKurus;
    onCustomPricesChange(map);
    setPriceEdits({});
  }, [onCustomPricesChange]);

  const loadSupplierDetail = useCallback(async (supplierId: number) => {
    const ov = await getMarinaApi().getSupplierOverview(supplierId);
    setSupplierOverview(ov);
    onCustomPricesChange({});
  }, [onCustomPricesChange]);

  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerStats(null);
      setRecentSales([]);
      setPurchaseRows([]);
      setProductPrices([]);
      if (selection?.type !== "supplier") onCustomPricesChange({});
      return;
    }
    void loadCustomerDetail(selectedCustomer.id);
  }, [selectedCustomer?.id, loadCustomerDetail, onCustomPricesChange, selection?.type]);

  useEffect(() => {
    if (!selectedSupplier) {
      setSupplierOverview(null);
      return;
    }
    void loadSupplierDetail(selectedSupplier.id);
  }, [selectedSupplier?.id, loadSupplierDetail, products]);

  useEffect(() => {
    if (!editCustomer || detailTab !== "history") return;
    let cancelled = false;
    setDetailSalesLoading(true);
    void getMarinaApi()
      .getSalesForCustomer(editCustomer.id, 80)
      .then((rows) => {
        if (!cancelled) setDetailSales(Array.isArray(rows) ? rows : []);
      })
      .finally(() => {
        if (!cancelled) setDetailSalesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editCustomer, detailTab]);

  const pickCustomer = (c: Customer) => {
    const next = selection?.type === "customer" && selection.id === c.id ? null : { type: "customer" as const, id: c.id };
    setSelection(next);
    onSelectCustomer(next ? next.id : null);
    setDetailTab("info");
  };

  const pickSupplier = (s: Supplier) => {
    const next = selection?.type === "supplier" && selection.id === s.id ? null : { type: "supplier" as const, id: s.id };
    setSelection(next);
    onSelectCustomer(null);
    setDetailTab("info");
  };

  const clearSelection = () => {
    setSelection(null);
    onSelectCustomer(null);
  };

  const patchCustomer = async (patch: Partial<CustomerInput>) => {
    if (!selectedCustomer) return;
    const updated = await getMarinaApi().updateCustomer(selectedCustomer.id, patch);
    if (updated) onCustomersChange?.();
  };

  const markCustomerDebtPaid = async (customer: Customer) => {
    if (customer.balanceOwedKurus <= 0) return;
    const amount = formatTry(customer.balanceOwedKurus);
    const payLabel = debtPayType === "card" ? "kart" : "nakit";
    if (
      !window.confirm(
        `${customer.name} icin acik borc (${amount}) ${payLabel} olarak tahsil edilsin mi? Tutar bugunun satislari ve gelire yazilir.`
      )
    ) {
      return;
    }
    setDebtPaySaving(true);
    try {
      await getMarinaApi().recordCustomerDebtPayment(customer.id, debtPayType);
      await onCustomersChange?.();
      if (selection?.type === "customer" && selection.id === customer.id) {
        await loadCustomerDetail(customer.id);
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Borc tahsilati kaydedilemedi.");
    } finally {
      setDebtPaySaving(false);
    }
  };

  const deleteCustomer = async (c: Customer) => {
    const label = c.kind === "wholesale" && c.companyName.trim() ? `${c.companyName.trim()} · ${c.name}` : c.name;
    if (!window.confirm(`"${label}" silinsin mi?`)) return;
    await getMarinaApi().deleteCustomer(c.id);
    if (selectedCustomerId === c.id) onSelectCustomer(null);
    if (selection?.type === "customer" && selection.id === c.id) setSelection(null);
    onCustomersChange?.();
  };

  const resetAddForm = () => {
    setAddForm({ name: "", phone: "", email: "", companyName: "", address: "", district: "", city: "", taxOrVkn: "", note: "", balanceTl: "", discountPct: "" });
    setSupplierForm({ name: "", phone: "", email: "", address: "", district: "", city: "", taxOffice: "", taxNumber: "", note: "", balanceTl: "" });
  };

  const customerFormAsContact = (form: typeof addForm): ContactFormShape => ({
    name: form.name,
    balanceTl: form.balanceTl,
    phone: form.phone,
    email: form.email,
    address: form.address,
    district: form.district,
    city: form.city,
    taxOffice: "",
    taxNumber: form.taxOrVkn,
    note: form.note
  });

  const patchCustomerFormFromContact = (patch: Partial<ContactFormShape>, setter: typeof setAddForm) => {
    setter((p) => ({
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

  const kafeFormAsContact = () => customerFormAsContact(addForm);
  const patchKafeForm = (patch: Partial<ContactFormShape>) => patchCustomerFormFromContact(patch, setAddForm);
  const patchEditFormFromContact = (patch: Partial<ContactFormShape>) => patchCustomerFormFromContact(patch, setEditForm);

  const submitAddCustomer = async (kind: CustomerKind = addKind) => {
    const name = addForm.name.trim();
    if (!name) {
      window.alert("Ad gerekli.");
      return;
    }
    const bal = Number(String(addForm.balanceTl).replace(",", "."));
    const disc = Number(String(addForm.discountPct).replace(",", "."));
    const created = await getMarinaApi().createCustomer({
      kind,
      name,
      phone: addForm.phone.trim(),
      email: addForm.email.trim(),
      companyName: addForm.companyName.trim(),
      address: addForm.address.trim(),
      district: addForm.district.trim(),
      city: addForm.city.trim(),
      taxOrVkn: addForm.taxOrVkn.trim(),
      note: addForm.note.trim(),
      balanceOwedKurus: Number.isFinite(bal) && bal >= 0 ? tlToKurus(bal) : 0,
      suggestedDiscountPercent: Number.isFinite(disc) ? Math.max(0, Math.min(100, disc)) : 0
    });
    setAddOpen(false);
    resetAddForm();
    onSelectCustomer(created.id);
    setSelection({ type: "customer", id: created.id });
    setDetailTab("info");
    onCustomersChange?.();
  };

  const submitLedgerAdd = async () => {
    if (ledgerTab === "supplier") {
      const payload = supplierInputFromForm(supplierForm);
      if (!payload.name) {
        window.alert("Ad gerekli.");
        return;
      }
      setLedgerAddSaving(true);
      try {
        const created = await getMarinaApi().createSupplier(payload);
        resetAddForm();
        setLedgerAddOpen(false);
        setSelection({ type: "supplier", id: created.id });
        onSelectCustomer(null);
        setDetailTab("info");
        onSuppliersChange?.();
      } finally {
        setLedgerAddSaving(false);
      }
      return;
    }
    const kind: CustomerKind = ledgerTab === "wholesale" ? "wholesale" : "retail_regular";
    setLedgerAddSaving(true);
    try {
      await submitAddCustomer(kind);
      setLedgerAddOpen(false);
    } finally {
      setLedgerAddSaving(false);
    }
  };

  const openEditCustomer = (c: Customer) => {
    setEditCustomer(c);
    setEditForm({
      name: c.name,
      phone: c.phone,
      email: c.email,
      companyName: c.companyName,
      address: c.address,
      district: c.district,
      city: c.city,
      taxOrVkn: c.taxOrVkn,
      note: c.note,
      balanceTl: c.balanceOwedKurus > 0 ? String(c.balanceOwedKurus / 100) : "",
      discountPct: c.suggestedDiscountPercent > 0 ? String(c.suggestedDiscountPercent) : ""
    });
    setDetailTab("info");
  };

  const submitEditCustomer = async () => {
    if (!editCustomer) return;
    setEditSaving(true);
    try {
      const bal = Number(String(editForm.balanceTl).replace(",", "."));
      const disc = Number(String(editForm.discountPct).replace(",", "."));
      const updated = await getMarinaApi().updateCustomer(editCustomer.id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
        companyName: editForm.companyName.trim(),
        address: editForm.address.trim(),
        district: editForm.district.trim(),
        city: editForm.city.trim(),
        taxOrVkn: editForm.taxOrVkn.trim(),
        note: editForm.note.trim(),
        balanceOwedKurus: Number.isFinite(bal) && bal >= 0 ? tlToKurus(bal) : 0,
        suggestedDiscountPercent: Number.isFinite(disc) ? Math.max(0, Math.min(100, disc)) : 0
      });
      setEditCustomer(null);
      onCustomersChange?.();
    } finally {
      setEditSaving(false);
    }
  };

  const saveProductPrice = async (productId: number) => {
    if (!selectedCustomer) return;
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const raw = priceEdits[productId] ?? "";
    const n = parseTrAmount(raw);
    const unit = categorySaleUnitOf(categories, product.categoryId);
    const kurus = n != null && n > 0 ? (unit === "gram" ? tlPer1000gToKurusPerGram(n) : tlToKurus(n)) : 0;
    await getMarinaApi().setCustomerProductPrice(selectedCustomer.id, productId, kurus);
    await loadCustomerDetail(selectedCustomer.id);
  };

  const renderCustomerRow = (c: Customer) => (
    <div key={c.id} className="customer-list-row-wrap">
      <button
        type="button"
        className={`customer-list-row-main${selection?.type === "customer" && selection.id === c.id ? " is-selected" : ""}`}
        onClick={() => pickCustomer(c)}
        onContextMenu={(e) => {
          e.preventDefault();
          openEditCustomer(c);
        }}
      >
        <span className="customer-list-name">
          {c.kind === "wholesale" && c.companyName.trim() ? `${c.companyName.trim()} · ` : null}
          {c.name}
          {c.balanceOwedKurus > 0 ? (
            <span className="customer-debt-badge" title="Acik borc">
              {formatTry(c.balanceOwedKurus)}
            </span>
          ) : null}
        </span>
        {c.phone.trim() ? <span className="customer-list-phone">{c.phone}</span> : null}
      </button>
      <button type="button" className="customer-list-delete-btn" onClick={() => void deleteCustomer(c)}>
        Sil
      </button>
    </div>
  );

  const renderSupplierRow = (s: Supplier) => (
    <div key={s.id} className="customer-list-row-wrap">
      <button
        type="button"
        className={`customer-list-row-main${selection?.type === "supplier" && selection.id === s.id ? " is-selected" : ""}`}
        onClick={() => pickSupplier(s)}
        onContextMenu={(e) => {
          e.preventDefault();
          setEditSupplier(s);
          setSupplierForm({
            name: s.name,
            phone: s.phone,
            email: s.email,
            address: s.address,
            district: s.district,
            city: s.city,
            taxOffice: s.taxOffice,
            taxNumber: s.taxNumber,
            note: s.note,
            balanceTl: s.balanceOwedKurus > 0 ? String(s.balanceOwedKurus / 100) : ""
          });
        }}
      >
        <span className="customer-list-name">
          {s.name}
          {s.balanceOwedKurus > 0 ? (
            <span className="supplier-debt-badge" title="Tedarikciye borc">
              {formatTry(s.balanceOwedKurus)}
            </span>
          ) : null}
        </span>
        {s.phone.trim() ? <span className="customer-list-phone">{s.phone}</span> : null}
      </button>
    </div>
  );

  const activeProducts = useMemo(() => products.filter((p) => p.isActive === 1), [products]);

  const renderCustomerDebtStrip = (items: Customer[], sectionLabel: string) => {
    if (items.length === 0) return null;
    return (
      <div className="customers-debt-strip" role="region" aria-label={`${sectionLabel} borclu musteriler`}>
        <p className="customers-debt-strip-title">
          Bize borclu
          <span className="customers-debt-strip-total customer-debt-badge">{formatTry(items.reduce((s, c) => s + c.balanceOwedKurus, 0))}</span>
        </p>
        <div className="customers-debt-strip-tags">
          {items.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`customer-debt-badge customers-debt-tag${selection?.type === "customer" && selection.id === c.id ? " is-selected" : ""}`}
              title={`${customerDebtLabel(c)} — listeye git`}
              onClick={() => pickCustomer(c)}
            >
              {customerDebtLabel(c)} · {formatTry(c.balanceOwedKurus)}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderSupplierDebtStrip = (items: Supplier[]) => {
    if (items.length === 0) return null;
    return (
      <div className="customers-debt-strip customers-debt-strip--supplier" role="region" aria-label="Borclu tedarikciler">
        <p className="customers-debt-strip-title">
          Borcumuz
          <span className="customers-debt-strip-total supplier-debt-badge">{formatTry(items.reduce((s, x) => s + x.balanceOwedKurus, 0))}</span>
        </p>
        <div className="customers-debt-strip-tags">
          {items.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`supplier-debt-badge customers-debt-tag${selection?.type === "supplier" && selection.id === s.id ? " is-selected" : ""}`}
              title={`${s.name} — listeye git`}
              onClick={() => pickSupplier(s)}
            >
              {s.name} · {formatTry(s.balanceOwedKurus)}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const detailOpen = Boolean(selectedCustomer || selectedSupplier);

  const ledgerTabLabel = (tab: CustomersPanelColumn) => {
    if (tab === "retail") return "Perakende";
    if (tab === "wholesale") return "Kafe";
    return "Tedarikci";
  };

  const renderLedgerAddForm = () => (
    <>
      {ledgerTab === "retail" ? (
        <div className="customers-ledger-add-fields customers-ledger-add-fields--compact">
          <label className="settings-field">
            <span>Ad soyad</span>
            <input
              value={addForm.name}
              onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Orn. Ahmet Yilmaz"
              disabled={ledgerAddSaving}
              autoFocus
            />
          </label>
          <label className="settings-field">
            <span>Telefon</span>
            <input
              value={addForm.phone}
              onChange={(e) => setAddForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="05xx xxx xx xx"
              disabled={ledgerAddSaving}
            />
          </label>
        </div>
      ) : null}
      {ledgerTab === "wholesale" || ledgerTab === "supplier" ? (
        renderSupplierLikeForm(
          ledgerTab === "wholesale" ? kafeFormAsContact() : supplierForm,
          ledgerTab === "wholesale" ? patchKafeForm : (patch) => setSupplierForm((p) => ({ ...p, ...patch })),
          ledgerAddSaving,
          {
            nameLabel: ledgerTab === "wholesale" ? "Kafe adi *" : "Ad *",
            balanceLabel: ledgerTab === "wholesale" ? "Bize borc (TL)" : "Acik borc (TL)",
            autoFocus: true
          }
        )
      ) : null}
    </>
  );

  const renderLedgerList = () => {
    if (ledgerTab === "retail") {
      return (
        <>
          {renderCustomerDebtStrip(retailDebtors, "Perakende")}
          <div className="customers-column-list">
            {retailCustomers.length > 0 ? retailCustomers.map(renderCustomerRow) : (
              <p className="customers-empty customers-list-section-empty">Perakende musteri yok.</p>
            )}
          </div>
        </>
      );
    }
    if (ledgerTab === "wholesale") {
      return (
        <>
          {renderCustomerDebtStrip(wholesaleDebtors, "Kafe")}
          <div className="customers-column-list">
            {wholesaleCustomers.length > 0 ? wholesaleCustomers.map(renderCustomerRow) : (
              <p className="customers-empty customers-list-section-empty">Kafe yok.</p>
            )}
          </div>
        </>
      );
    }
    return (
      <>
        {renderSupplierDebtStrip(suppliersWithDebtFiltered)}
        <div className="customers-column-list">
          {filteredSuppliers.length > 0 ? filteredSuppliers.map(renderSupplierRow) : (
            <p className="customers-empty customers-list-section-empty">Tedarikci yok.</p>
          )}
        </div>
      </>
    );
  };

  const renderDetailPanel = () => {
    if (!detailOpen) {
      return (
        <div className="customers-ledger-detail-empty">
          <p className="customers-hint">Soldan bir {ledgerTabLabel(ledgerTab).toLowerCase()} kaydi secin; gecmis ve fatura bilgileri burada acilir.</p>
        </div>
      );
    }
    return (
      <div className="customer-hub-detail">
        <div className="customer-hub-detail-head">
          <div>
            <h3>{selectedCustomer?.name ?? selectedSupplier?.name}</h3>
            <span className={`customer-kind-badge ${selectedCustomer ? `customer-kind-${selectedCustomer.kind}` : "customer-kind-supplier"}`}>
              {selectedCustomer ? customerKindLabel(selectedCustomer.kind) : "Tedarikci (stok)"}
            </span>
          </div>
          <button type="button" className="customer-clear-select" onClick={clearSelection}>
            Secimi kaldir
          </button>
        </div>

        <div className="customer-detail-tabs" role="tablist">
          <button type="button" role="tab" className={detailTab === "info" ? "active" : ""} onClick={() => setDetailTab("info")}>
            Bilgiler
          </button>
          {selectedCustomer ? (
            <>
              <button type="button" role="tab" className={detailTab === "prices" ? "active" : ""} onClick={() => setDetailTab("prices")}>
                Ozel fiyat
              </button>
              <button type="button" role="tab" className={detailTab === "history" ? "active" : ""} onClick={() => setDetailTab("history")}>
                Gecmis / aldiklari
              </button>
            </>
          ) : (
            <button type="button" role="tab" className={detailTab === "history" ? "active" : ""} onClick={() => setDetailTab("history")}>
              Urunler ve stok girisi
            </button>
          )}
        </div>

        <div className="customer-hub-detail-body">
          {detailTab === "info" && selectedCustomer && (
            <div className="customer-detail-card customer-detail-card-flat">
              {selectedCustomer.phone.trim() ? <p className="customer-detail-phone">{selectedCustomer.phone}</p> : null}
              {selectedCustomer.kind === "wholesale" && selectedCustomer.companyName.trim() ? (
                <p className="muted small">Firma: {selectedCustomer.companyName}</p>
              ) : null}
              {selectedCustomer.email.trim() ? <p className="muted small">{selectedCustomer.email}</p> : null}
              {selectedCustomer.taxOrVkn.trim() ? <p className="muted small">TC/VKN: {selectedCustomer.taxOrVkn}</p> : null}
              {(selectedCustomer.address.trim() || selectedCustomer.city.trim()) ? (
                <p className="muted small">
                  {[selectedCustomer.address, selectedCustomer.district, selectedCustomer.city].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              <label className="customer-field">
                <span>Not</span>
                <textarea
                  key={`n-${selectedCustomer.id}`}
                  className="customer-note-area"
                  defaultValue={selectedCustomer.note}
                  onBlur={(e) => void patchCustomer({ note: e.target.value })}
                  rows={2}
                />
              </label>
              <div
                className={`customer-field-grid${selectedCustomer.balanceOwedKurus > 0 ? " customer-field-grid--with-pay" : ""}`}
              >
                <label className="customer-field">
                  <span>Borc (TL)</span>
                  <input
                    key={`b-${selectedCustomer.id}`}
                    type="text"
                    inputMode="decimal"
                    defaultValue={selectedCustomer.balanceOwedKurus > 0 ? String(selectedCustomer.balanceOwedKurus / 100) : ""}
                    onBlur={(e) => {
                      const n = Number(String(e.target.value).replace(",", "."));
                      void patchCustomer({ balanceOwedKurus: Number.isFinite(n) && n >= 0 ? tlToKurus(n) : 0 });
                    }}
                  />
                </label>
                {selectedCustomer.balanceOwedKurus > 0 ? (
                  <div className="customer-debt-paid-cell">
                    <span className="customer-debt-paid-label">Tahsilat</span>
                    <div className="customer-debt-pay-type" role="group" aria-label="Odeme tipi">
                      <button
                        type="button"
                        className={debtPayType === "cash" ? "active" : ""}
                        disabled={debtPaySaving}
                        onClick={() => setDebtPayType("cash")}
                      >
                        Nakit
                      </button>
                      <button
                        type="button"
                        className={debtPayType === "card" ? "active" : ""}
                        disabled={debtPaySaving}
                        onClick={() => setDebtPayType("card")}
                      >
                        Kart
                      </button>
                    </div>
                    <button
                      type="button"
                      className="cart-debt-panel-paid-btn customer-debt-paid-btn"
                      disabled={debtPaySaving}
                      onClick={() => void markCustomerDebtPaid(selectedCustomer)}
                    >
                      {debtPaySaving ? "Kaydediliyor..." : "Borc odendi"}
                    </button>
                  </div>
                ) : null}
                <label className="customer-field">
                  <span>Indirim %</span>
                  <input
                    key={`d-${selectedCustomer.id}`}
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={selectedCustomer.suggestedDiscountPercent || ""}
                    onBlur={(e) => {
                      const n = Number(e.target.value);
                      void patchCustomer({
                        suggestedDiscountPercent: Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0
                      });
                    }}
                  />
                </label>
              </div>
              {selectedCustomer.balanceOwedKurus > 0 ? (
                <p className="customer-debt-summary">
                  Acik borc: <span className="customer-debt-badge customer-debt-badge-lg">{formatTry(selectedCustomer.balanceOwedKurus)}</span>
                </p>
              ) : null}
              {customerStats && (
                <div className="customer-stats-row">
                  <div>
                    <span className="customer-stats-label">Islem</span>
                    <span className="customer-stats-value">{customerStats.transactionCount}</span>
                  </div>
                  <div>
                    <span className="customer-stats-label">Net ciro</span>
                    <span className="customer-stats-value">{formatTry(customerStats.netTotalKurus)}</span>
                  </div>
                  <div>
                    <span className="customer-stats-label">Son islem</span>
                    <span className="customer-stats-value">
                      {customerStats.lastTransactionAt ? formatSaleTime(customerStats.lastTransactionAt) : "—"}
                    </span>
                  </div>
                </div>
              )}
              <button type="button" className="linkish" onClick={() => openEditCustomer(selectedCustomer)}>
                Tum bilgileri duzenle / fatura
              </button>
            </div>
          )}

          {detailTab === "info" && selectedSupplier && (
            <div className="customer-detail-card customer-detail-card-flat">
              {selectedSupplier.balanceOwedKurus > 0 ? (
                <p className="customer-debt-summary">
                  Tedarikci borcu:{" "}
                  <span className="supplier-debt-badge supplier-debt-badge-lg">{formatTry(selectedSupplier.balanceOwedKurus)}</span>
                </p>
              ) : (
                <p className="muted small">Acik tedarikci borcu yok.</p>
              )}
              <p className="muted small">{selectedSupplier.address || "Adres girilmemis"}</p>
              <p className="muted small">
                {selectedSupplier.phone}
                {selectedSupplier.email ? ` · ${selectedSupplier.email}` : ""}
              </p>
              <button
                type="button"
                className="linkish"
                onClick={() => {
                  if (!selectedSupplier) return;
                  setEditSupplier(selectedSupplier);
                  setSupplierForm({
                    name: selectedSupplier.name,
                    phone: selectedSupplier.phone,
                    email: selectedSupplier.email,
                    address: selectedSupplier.address,
                    district: selectedSupplier.district,
                    city: selectedSupplier.city,
                    taxOffice: selectedSupplier.taxOffice,
                    taxNumber: selectedSupplier.taxNumber,
                    note: selectedSupplier.note,
                    balanceTl: selectedSupplier.balanceOwedKurus > 0 ? String(selectedSupplier.balanceOwedKurus / 100) : ""
                  });
                }}
              >
                Tedarikci bilgilerini duzenle
              </button>
            </div>
          )}

          {detailTab === "prices" && selectedCustomer && (
            <div className="customer-prices-panel">
              <p className="customer-pricing-hint">
                Bos birakip kaydederseniz ozel fiyat kaldirilir. POS sepetinde bu musteri seciliyken urun eklenince ozel birim fiyat uygulanir.
              </p>
              <div className="customer-prices-table-wrap">
                <table className="cashflow-table customer-prices-table">
                  <thead>
                    <tr>
                      <th>Urun</th>
                      <th>Liste</th>
                      <th>Ozel fiyat</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {activeProducts.map((p) => {
                      const existing = productPrices.find((x) => x.productId === p.id);
                      const unit = categorySaleUnitOf(categories, p.categoryId);
                      const listKurus = p.priceKurus;
                      const placeholder =
                        existing != null
                          ? unit === "gram"
                            ? kurusPerGramToTlPer1000g(existing.priceKurus).toFixed(2)
                            : (existing.priceKurus / 100).toFixed(2)
                          : unit === "gram"
                            ? kurusPerGramToTlPer1000g(listKurus).toFixed(2)
                            : (listKurus / 100).toFixed(2);
                      return (
                        <tr key={p.id}>
                          <td>
                            <span className="closure-code">{p.code}</span> {p.name}
                          </td>
                          <td>{unitPriceLabel(categories, p, listKurus)}</td>
                          <td>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="customer-price-input"
                              placeholder={placeholder}
                              value={priceEdits[p.id] ?? ""}
                              onChange={(e) => setPriceEdits((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            />
                            <small className="muted">{unit === "gram" ? "TL / 1000 g" : "TL / adet"}</small>
                          </td>
                          <td>
                            <button type="button" onClick={() => void saveProductPrice(p.id)}>
                              Kaydet
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {detailTab === "history" && selectedCustomer && (
            <div className="customer-history-panel">
              <h4>Aldigi urunler (ozet)</h4>
              {purchaseRows.length === 0 ? (
                <p className="muted small">Henuz satis kaydi yok.</p>
              ) : (
                <table className="cashflow-table">
                  <thead>
                    <tr>
                      <th>Urun</th>
                      <th>Toplam miktar</th>
                      <th>Ciro</th>
                      <th>Son alis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseRows.map((r) => (
                      <tr key={r.productId}>
                        <td>
                          <span className="closure-code">{r.productCode}</span> {r.productName}
                        </td>
                        <td>{formatQtyShort(r.totalQty, r.saleUnit)}</td>
                        <td>{formatTry(r.totalRevenueKurus)}</td>
                        <td>{r.lastPurchaseAt ? formatSaleTime(r.lastPurchaseAt) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {recentSales.some((sw) => (sw.sale.debtAddedKurus ?? 0) > 0) ? (
                <>
                  <h4>Borc hareketleri</h4>
                  <table className="cashflow-table customer-debt-history-table">
                    <thead>
                      <tr>
                        <th>Tarih</th>
                        <th>Satis</th>
                        <th>Borc eklendi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSales
                        .filter((sw) => (sw.sale.debtAddedKurus ?? 0) > 0)
                        .map((sw) => (
                          <tr key={`debt-${sw.sale.id}`}>
                            <td>{formatSaleTime(sw.sale.createdAt)}</td>
                            <td>
                              <button type="button" className="linkish" onClick={() => onOpenSaleDetail(sw.sale.id)}>
                                #{sw.sale.id}
                              </button>
                            </td>
                            <td>
                              <span className="customer-debt-badge customer-debt-badge-inline">
                                {formatTry(sw.sale.debtAddedKurus!)}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </>
              ) : null}
              <h4>Son islemler</h4>
              <ul className="customer-recent-list">
                {recentSales.map((sw) => (
                  <li key={sw.sale.id}>
                    <button type="button" className="customer-recent-btn" onClick={() => onOpenSaleDetail(sw.sale.id)}>
                      <span>
                        #{sw.sale.id} · {formatSaleTime(sw.sale.createdAt)}
                        {(sw.sale.debtAddedKurus ?? 0) > 0 ? (
                          <span className="customer-debt-badge customer-debt-badge-inline">
                            +borc {formatTry(sw.sale.debtAddedKurus!)}
                          </span>
                        ) : null}
                      </span>
                      <span>{formatTry(sw.sale.subtotalKurus)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {detailTab === "history" && selectedSupplier && supplierOverview && (
            <div className="customer-history-panel">
              <h4>Bu tedarikciden urunler ({supplierOverview.products.length})</h4>
              {supplierOverview.products.length === 0 ? (
                <p className="muted small">Urun kartinda bu tedarikci secilmemis.</p>
              ) : (
                <table className="cashflow-table">
                  <thead>
                    <tr>
                      <th>Urun</th>
                      <th>Stok</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierOverview.products.map((p) => (
                      <tr key={p.productId}>
                        <td>
                          <span className="closure-code">{p.productCode}</span> {p.productName}
                        </td>
                        <td>{formatQtyShort(p.stockQty, p.saleUnit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <h4>Stok giris gecmisi</h4>
              <p className="muted small">Tedarikciden gelen her stok girisi: urun, miktar, birim gelis ve toplam maliyet.</p>
              {supplierOverview.stockEntries.length === 0 ? (
                <p className="muted small">Stok girisi yok.</p>
              ) : (
                <table className="cashflow-table">
                  <thead>
                    <tr>
                      <th>Tarih</th>
                      <th>Urun</th>
                      <th>Miktar</th>
                      <th>Birim gelis</th>
                      <th>Toplam</th>
                      <th>Not</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierOverview.stockEntries.slice(0, 100).map((e) => (
                      <tr key={e.movementId}>
                        <td>{formatSaleTime(e.createdAt)}</td>
                        <td>
                          <span className="closure-code">{e.productCode}</span> {e.productName}
                        </td>
                        <td>{formatQtyShort(e.qty, e.saleUnit ?? "piece")}</td>
                        <td>{stockEntryUnitCostLabel(e)}</td>
                        <td>
                          {e.lineCostKurus != null && e.lineCostKurus > 0 ? formatTry(e.lineCostKurus) : "—"}
                          {(e.debtAddedKurus ?? 0) > 0 ? (
                            <span className="supplier-debt-badge supplier-debt-badge-inline" title="Kalan borc">
                              {" "}
                              borc {formatTry(e.debtAddedKurus!)}
                            </span>
                          ) : null}
                        </td>
                        <td>{e.note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderColumnSection = (col: CustomersPanelColumn) => {
    if (col === "retail") {
      return (
        <section className="customers-column" key="retail">
          <h4 className="customers-column-title">Perakende musteri</h4>
          {renderCustomerDebtStrip(retailDebtors, "Perakende")}
          <div className="customers-column-list">
            {retailCustomers.length > 0 ? retailCustomers.map(renderCustomerRow) : (
              <p className="customers-empty customers-list-section-empty">Kayit yok.</p>
            )}
          </div>
        </section>
      );
    }
    if (col === "wholesale") {
      return (
        <section className="customers-column" key="wholesale">
          <h4 className="customers-column-title">Kafe</h4>
          {renderCustomerDebtStrip(wholesaleDebtors, "Kafe")}
          <div className="customers-column-list">
            {wholesaleCustomers.length > 0 ? wholesaleCustomers.map(renderCustomerRow) : (
              <p className="customers-empty customers-list-section-empty">Kayit yok.</p>
            )}
          </div>
        </section>
      );
    }
    return (
      <section className="customers-column" key="supplier">
        <h4 className="customers-column-title">Tedarikci</h4>
        {renderSupplierDebtStrip(suppliersWithDebtFiltered)}
        <div className="customers-column-list">
          {filteredSuppliers.length > 0 ? filteredSuppliers.map(renderSupplierRow) : (
            <p className="customers-empty customers-list-section-empty">Kayit yok.</p>
          )}
        </div>
      </section>
    );
  };

  return (
    <div
      className={`customers-panel-root${layout === "ledger" ? " customers-panel-root--ledger" : ""}${detailOpen ? " customers-panel-root--detail-open" : ""}`}
    >
      <label className="search-wrap">
        <span className="search-icon">⌕</span>
        <input
          className="search"
          placeholder="Ara: ad, telefon, firma, adres..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>

      {layout === "ledger" ? (
        <div className="customers-toolbar customers-toolbar-ledger">
          <div className="customers-ledger-tab-row">
            <div className="payment-segment customers-ledger-tabs" role="tablist" aria-label="Kayit turu">
              {(["retail", "wholesale", "supplier"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={ledgerTab === tab}
                  className={ledgerTab === tab ? "active" : ""}
                  onClick={() => setLedgerTab(tab)}
                >
                  {ledgerTabLabel(tab)}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="customers-add-btn customers-ledger-add-trigger"
              onClick={() => setLedgerAddOpen(true)}
            >
              + {ledgerTabLabel(ledgerTab)} ekle
            </button>
          </div>
          <p className="customers-hint">
            {ledgerTab === "retail"
              ? "Perakende musteri: isim ve telefon yeterli. Satira tiklayin; gecmis sagda."
              : ledgerTab === "wholesale"
                ? "Kafe: iletisim ve fatura alanlari. Ozel fiyat ve alis gecmisi sagda."
                : "Tedarikci: stok kaynagi; bagli urunler ve stok girisi gecmisi sagda."}
          </p>
        </div>
      ) : (
        <div className="customers-toolbar customers-toolbar-split">
          {column === "retail" ? (
            <button type="button" className="customers-add-btn" onClick={() => { setAddKind("retail_regular"); setAddOpen(true); }}>
              + Perakende musteri
            </button>
          ) : null}
          {column === "wholesale" ? (
            <button type="button" className="customers-add-btn" onClick={() => { setAddKind("wholesale"); setAddOpen(true); }}>
              + Kafe
            </button>
          ) : null}
          {column === "supplier" ? (
            <button type="button" className="customers-add-btn" onClick={() => setAddSupplierOpen(true)}>
              + Tedarikci
            </button>
          ) : null}
          <p className="customers-hint">
            {column === "retail"
              ? "Perakende musteri listesi. Secili kayit altta; ozel fiyat ve gecmis sekmeleri. Sag tik: duzenleme."
              : column === "wholesale"
                ? "Kafe: aldigi urunler, ozel fiyat ve alis gecmisi. Sag tik: duzenleme."
                : "Tedarikci (stok kaynagi): bagli urunler ve stok girisi ozeti. Sag tik: duzenleme."}
          </p>
        </div>
      )}

      {layout === "ledger" ? (
        <div className="customers-ledger-split" role="region" aria-label="Kayit defteri">
          <section className="customers-ledger-list-col">
            <h4 className="customers-column-title">{ledgerTabLabel(ledgerTab)}</h4>
            {renderLedgerList()}
          </section>
          <section className="customers-ledger-detail-col" aria-label="Kayit detayi">
            {renderDetailPanel()}
          </section>
        </div>
      ) : (
        <>
          <div className="customers-single-column">{renderColumnSection(column)}</div>
          {detailOpen ? renderDetailPanel() : null}
        </>
      )}

      {layout === "ledger" && ledgerAddOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => {
            if (!ledgerAddSaving) setLedgerAddOpen(false);
          }}
        >
          <div
            className="modal-dialog supplier-edit-dialog customer-ledger-add-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ledger-add-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="ledger-add-title">Yeni {ledgerTabLabel(ledgerTab).toLowerCase()}</h3>
            {renderLedgerAddForm()}
            <div className="modal-actions">
              <button type="button" disabled={ledgerAddSaving} onClick={() => setLedgerAddOpen(false)}>
                Vazgec
              </button>
              <button type="button" className="primary" disabled={ledgerAddSaving} onClick={() => void submitLedgerAdd()}>
                {ledgerAddSaving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {addOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setAddOpen(false)}>
          <div
            className={`modal-dialog ${addKind === "retail_regular" ? "customer-add-dialog" : "supplier-edit-dialog"}`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3>Yeni {customerAddKindLabel(addKind)}</h3>
            <div className="payment-segment customer-add-kind-segment">
              <button type="button" className={addKind === "retail_regular" ? "active" : ""} onClick={() => setAddKind("retail_regular")}>
                Perakende
              </button>
              <button type="button" className={addKind === "wholesale" ? "active" : ""} onClick={() => setAddKind("wholesale")}>
                Kafe
              </button>
            </div>
            {addKind === "retail_regular" ? (
              <>
                <label className="settings-field">
                  <span>Ad soyad</span>
                  <input value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} autoFocus />
                </label>
                <label className="settings-field">
                  <span>Telefon</span>
                  <input value={addForm.phone} onChange={(e) => setAddForm((p) => ({ ...p, phone: e.target.value }))} />
                </label>
              </>
            ) : (
              renderSupplierLikeForm(kafeFormAsContact(), patchKafeForm, false, {
                nameLabel: "Kafe adi *",
                balanceLabel: "Bize borc (TL)",
                autoFocus: true
              })
            )}
            <div className="modal-actions">
              <button type="button" onClick={() => setAddOpen(false)}>Vazgec</button>
              <button type="button" className="primary" onClick={() => void submitAddCustomer()}>
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {editCustomer && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !editSaving && setEditCustomer(null)}>
          <div
            className={`modal-dialog ${editCustomer.kind === "wholesale" ? "supplier-edit-dialog" : "customer-detail-edit-dialog"}`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3>Duzenle · {customerKindShort(editCustomer.kind)}</h3>
            {editCustomer.kind === "wholesale" ? (
              renderSupplierLikeForm(customerFormAsContact(editForm), patchEditFormFromContact, editSaving, {
                nameLabel: "Kafe adi *",
                balanceLabel: "Bize borc (TL)"
              })
            ) : (
              <>
                <label className="settings-field">
                  <span>Ad</span>
                  <input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} disabled={editSaving} />
                </label>
                <label className="settings-field">
                  <span>Telefon</span>
                  <input value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} disabled={editSaving} />
                </label>
                <label className="settings-field">
                  <span>E-posta</span>
                  <input value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} disabled={editSaving} />
                </label>
                <label className="settings-field settings-field-wide">
                  <span>Adres</span>
                  <input value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} disabled={editSaving} />
                </label>
                <label className="settings-field settings-field-wide">
                  <span>Not</span>
                  <textarea value={editForm.note} onChange={(e) => setEditForm((p) => ({ ...p, note: e.target.value }))} rows={2} disabled={editSaving} />
                </label>
              </>
            )}
            <div className="modal-actions">
              <button type="button" className="customer-modal-delete-btn" disabled={editSaving} onClick={() => void deleteCustomer(editCustomer)}>
                Sil
              </button>
              <button type="button" disabled={editSaving} onClick={() => setEditCustomer(null)}>Vazgec</button>
              <button type="button" className="primary" disabled={editSaving} onClick={() => void submitEditCustomer()}>
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {addSupplierOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setAddSupplierOpen(false)}>
          <div className="modal-dialog supplier-edit-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <h3>Yeni tedarikci</h3>
            {renderSupplierLikeForm(supplierForm, (patch) => setSupplierForm((p) => ({ ...p, ...patch })), false, { autoFocus: true })}
            <div className="modal-actions">
              <button type="button" onClick={() => setAddSupplierOpen(false)}>Vazgec</button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  void (async () => {
                    const payload = supplierInputFromForm(supplierForm);
                    if (!payload.name) {
                      window.alert("Ad gerekli.");
                      return;
                    }
                    await getMarinaApi().createSupplier(payload);
                    setAddSupplierOpen(false);
                    resetAddForm();
                    onSuppliersChange?.();
                  })();
                }}
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {editSupplier && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditSupplier(null)}>
          <div className="modal-dialog supplier-edit-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <h3>Tedarikci duzenle</h3>
            {renderSupplierLikeForm(supplierForm, (patch) => setSupplierForm((p) => ({ ...p, ...patch })), false)}
            <div className="modal-actions">
              <button type="button" onClick={() => setEditSupplier(null)}>Vazgec</button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  void (async () => {
                    const payload = supplierInputFromForm(supplierForm);
                    if (!payload.name) {
                      window.alert("Ad gerekli.");
                      return;
                    }
                    await getMarinaApi().updateSupplier(editSupplier.id, payload);
                    setEditSupplier(null);
                    onSuppliersChange?.();
                  })();
                }}
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
