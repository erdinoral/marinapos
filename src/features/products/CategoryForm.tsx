import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getMarinaApi } from "../../api/marinaClient";
import type { Category, CategorySaleUnit, Product, Supplier, SupplierInput } from "../../types/models";
import { formatTry, parseTrAmount, tlToKurus } from "../../utils/currency";
import { totalSupplierDebtKurus } from "../../utils/supplierDebt";
import {
  categorySaleUnitOf,
  formatQtyShort,
  kurusPerGramToTlPer1000g,
  pricePlaceholder,
  tlPer1000gToKurusPerGram,
  wholesalePricePlaceholder
} from "../../utils/saleUnit";

interface Props {
  categories: Category[];
  suppliers: Supplier[];
  products: Product[];
  onCreated: () => Promise<void>;
}

type CategoryProductRow = {
  productId: number;
  name: string;
  priceTl: string;
  sellsWholesale: boolean;
  wholesaleTl: string;
  stockQty: string;
  discountPercent: string;
};

function priceTlDisplay(p: Product, unit: CategorySaleUnit): string {
  if (unit === "gram") return kurusPerGramToTlPer1000g(p.priceKurus).toFixed(2);
  return (p.priceKurus / 100).toFixed(2);
}

function wholesaleTlDisplay(p: Product, unit: CategorySaleUnit): string {
  if (p.wholesalePriceKurus <= 0) return "";
  if (unit === "gram") return kurusPerGramToTlPer1000g(p.wholesalePriceKurus).toFixed(2);
  return (p.wholesalePriceKurus / 100).toFixed(2);
}

function productRowsForCategory(products: Product[], categoryId: number, unit: CategorySaleUnit): CategoryProductRow[] {
  return products
    .filter((p) => p.categoryId === categoryId && p.isActive === 1)
    .sort((a, b) => a.name.localeCompare(b.name, "tr"))
    .map((p) => ({
      productId: p.id,
      name: p.name,
      priceTl: priceTlDisplay(p, unit),
      sellsWholesale: p.wholesalePriceKurus > 0,
      wholesaleTl: wholesaleTlDisplay(p, unit),
      stockQty: String(p.stockQty),
      discountPercent: String(p.discountPercent ?? 0)
    }));
}

function unitBadge(u: CategorySaleUnit) {
  return u === "gram" ? "Gram" : "Adet";
}

const emptySupplierExtra = {
  note: "",
  phone: "",
  email: "",
  address: "",
  district: "",
  city: "",
  taxOffice: "",
  taxNumber: ""
};

export function CategoryForm({ categories, suppliers, products, onCreated }: Props) {
  const supplierDebtTotalKurus = totalSupplierDebtKurus(suppliers);
  const [name, setName] = useState("");
  const [saleUnit, setSaleUnit] = useState<CategorySaleUnit>("piece");
  const [supplierName, setSupplierName] = useState("");
  const [supplierExtra, setSupplierExtra] = useState({ ...emptySupplierExtra });
  const [formMessage, setFormMessage] = useState("");
  const [categoryEdit, setCategoryEdit] = useState<Category | null>(null);
  const [categoryEditName, setCategoryEditName] = useState("");
  const [categoryEditUnit, setCategoryEditUnit] = useState<CategorySaleUnit>("piece");
  const [categoryProductRows, setCategoryProductRows] = useState<CategoryProductRow[]>([]);
  const [categoryEditSaving, setCategoryEditSaving] = useState(false);
  const [supplierEdit, setSupplierEdit] = useState<Supplier | null>(null);
  const [supplierEditForm, setSupplierEditForm] = useState({ name: "", balanceTl: "", ...emptySupplierExtra });
  const [supplierEditSaving, setSupplierEditSaving] = useState(false);

  const openCategoryEdit = (c: Category) => {
    setCategoryEdit(c);
    setCategoryEditName(c.name);
    setCategoryEditUnit(c.saleUnit);
    setCategoryProductRows(productRowsForCategory(products, c.id, c.saleUnit));
  };

  useEffect(() => {
    if (!supplierEdit) return;
    setSupplierEditForm({
      name: supplierEdit.name,
      balanceTl: supplierEdit.balanceOwedKurus > 0 ? String(supplierEdit.balanceOwedKurus / 100) : "",
      note: supplierEdit.note,
      phone: supplierEdit.phone,
      email: supplierEdit.email,
      address: supplierEdit.address,
      district: supplierEdit.district,
      city: supplierEdit.city,
      taxOffice: supplierEdit.taxOffice,
      taxNumber: supplierEdit.taxNumber
    });
  }, [supplierEdit]);

  useEffect(() => {
    if (!supplierEdit && !categoryEdit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (supplierEdit && !supplierEditSaving) setSupplierEdit(null);
      if (categoryEdit && !categoryEditSaving) setCategoryEdit(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [supplierEdit, supplierEditSaving, categoryEdit, categoryEditSaving]);

  const submitCategoryEdit = async () => {
    if (!categoryEdit) return;
    const n = categoryEditName.trim();
    if (!n) {
      window.alert("Kategori adi bos olamaz.");
      return;
    }
    setCategoryEditSaving(true);
    try {
      await getMarinaApi().updateCategory(categoryEdit.id, { name: n, saleUnit: categoryEditUnit });
      const unit = categoryEditUnit;
      for (const row of categoryProductRows) {
        const pname = row.name.trim();
        if (!pname) throw new Error("Urun adi bos olamaz.");
        const priceTl = Number(String(row.priceTl).replace(",", "."));
        const wholesaleTl = Number(String(row.wholesaleTl).replace(",", "."));
        const stockQty = Number(String(row.stockQty).replace(",", "."));
        const discountPercent = Number(String(row.discountPercent).replace(",", "."));
        if (!Number.isFinite(priceTl) || priceTl <= 0) throw new Error(`"${pname}" icin gecerli satis fiyati girin.`);
        if (!Number.isFinite(stockQty) || stockQty < 0) throw new Error(`"${pname}" icin gecerli stok girin.`);
        if (unit === "gram" && !Number.isInteger(Math.round(stockQty))) {
          throw new Error(`"${pname}" icin gram stok tam sayi olmalidir.`);
        }
        if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
          throw new Error(`"${pname}" icin indirim % 0-100 arasi olmali.`);
        }
        if (row.sellsWholesale && (!Number.isFinite(wholesaleTl) || wholesaleTl <= 0)) {
          throw new Error(`"${pname}" icin toptan fiyat girin veya toptan satisi kapatin.`);
        }
        const priceKurus = unit === "gram" ? tlPer1000gToKurusPerGram(priceTl) : tlToKurus(priceTl);
        await getMarinaApi().updateProduct(row.productId, {
          name: pname,
          priceKurus,
          wholesalePriceKurus:
            row.sellsWholesale && Number.isFinite(wholesaleTl) && wholesaleTl > 0
              ? unit === "gram"
                ? tlPer1000gToKurusPerGram(wholesaleTl)
                : tlToKurus(wholesaleTl)
              : 0,
          stockQty: unit === "gram" ? Math.round(stockQty) : stockQty,
          discountPercent
        });
      }
      setCategoryEdit(null);
      setFormMessage("Kategori ve urunler guncellendi.");
      await onCreated();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Guncellenemedi.");
    } finally {
      setCategoryEditSaving(false);
    }
  };

  const submit = async () => {
    const n = name.trim();
    if (!n) return;
    setFormMessage("");
    try {
      await getMarinaApi().createCategory(n, saleUnit);
      setName("");
      setSaleUnit("piece");
      setFormMessage("Kategori kaydedildi.");
      await onCreated();
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Kategori eklenemedi.");
    }
  };

  const submitSupplier = async () => {
    const n = supplierName.trim();
    if (!n) {
      setFormMessage("Tedarikci adi girin.");
      return;
    }
    setFormMessage("");
    const beforeIds = new Set(suppliers.map((s) => s.id));
    const payload: SupplierInput = {
      name: n,
      note: supplierExtra.note.trim(),
      phone: supplierExtra.phone.trim(),
      email: supplierExtra.email.trim(),
      address: supplierExtra.address.trim(),
      district: supplierExtra.district.trim(),
      city: supplierExtra.city.trim(),
      taxOffice: supplierExtra.taxOffice.trim(),
      taxNumber: supplierExtra.taxNumber.trim()
    };
    try {
      const created = await getMarinaApi().createSupplier(payload);
      setSupplierName("");
      setSupplierExtra({ ...emptySupplierExtra });
      if (beforeIds.has(created.id)) {
        setFormMessage("Bu isimde tedarikci zaten kayitli (yeni kayit eklenmedi).");
      } else {
        setFormMessage("Tedarikci kaydedildi (eksik alanlari sonradan sag tik ile tamamlayabilirsiniz).");
      }
      await onCreated();
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Tedarikci eklenemedi.");
    }
  };

  const submitSupplierEdit = async () => {
    if (!supplierEdit) return;
    const n = supplierEditForm.name.trim();
    if (!n) {
      window.alert("Tedarikci adi bos olamaz.");
      return;
    }
    setSupplierEditSaving(true);
    try {
      const bal = parseTrAmount(supplierEditForm.balanceTl.trim());
      await getMarinaApi().updateSupplier(supplierEdit.id, {
        name: n,
        balanceOwedKurus: bal != null && bal >= 0 ? tlToKurus(bal) : 0,
        note: supplierEditForm.note.trim(),
        phone: supplierEditForm.phone.trim(),
        email: supplierEditForm.email.trim(),
        address: supplierEditForm.address.trim(),
        district: supplierEditForm.district.trim(),
        city: supplierEditForm.city.trim(),
        taxOffice: supplierEditForm.taxOffice.trim(),
        taxNumber: supplierEditForm.taxNumber.trim()
      });
      setSupplierEdit(null);
      setFormMessage("Tedarikci guncellendi.");
      await onCreated();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Guncellenemedi.");
    } finally {
      setSupplierEditSaving(false);
    }
  };

  return (
    <motion.div
      className="category-form"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h2>Kategori Ekle</h2>
      <p className="category-form-hint">
        Satis birimi: <strong>Adet</strong> urunlerde POS ve stok adet; <strong>Gram</strong> urunlerde gramaj, satis fiyati TL/gram,
        gelis maliyeti TL/1000 g olarak girilir.
      </p>
      <input placeholder="Kategori adi" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="sale-unit-row" role="group" aria-label="Satis turu">
        <label className="sale-unit-option">
          <input type="radio" name="catSaleUnit" checked={saleUnit === "piece"} onChange={() => setSaleUnit("piece")} />
          Adetli satis
        </label>
        <label className="sale-unit-option">
          <input type="radio" name="catSaleUnit" checked={saleUnit === "gram"} onChange={() => setSaleUnit("gram")} />
          Gramajli satis
        </label>
      </div>
      <button type="button" onClick={() => void submit()}>
        Kategori Kaydet
      </button>
      {formMessage && <p className="form-message">{formMessage}</p>}
      <h3 className="category-list-title">Mevcut kategoriler</h3>
      <ul className="category-list">
        {categories.map((c) => (
          <li
            key={c.id}
            className="category-list-row-edit"
            title="Sag tik veya Duzenle: kategori ve urunleri guncelle"
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openCategoryEdit(c);
            }}
          >
            <span>{c.name}</span>
            <span className="category-badge">{unitBadge(c.saleUnit)}</span>
            <button type="button" className="category-edit-btn" title="Kategori ve urunleri duzenle" onClick={() => openCategoryEdit(c)}>
              Duzenle
            </button>
            <button
              type="button"
              className="category-delete-btn"
              title="Kategoriyi sil (icinde urun olmamali)"
              onClick={() => {
                if (!window.confirm(`"${c.name}" kategorisi silinsin mi?`)) return;
                void (async () => {
                  setFormMessage("");
                  try {
                    await getMarinaApi().deleteCategory(c.id);
                    setFormMessage("Kategori silindi.");
                    await onCreated();
                  } catch (error) {
                    setFormMessage(error instanceof Error ? error.message : "Silinemedi.");
                  }
                })();
              }}
            >
              Sil
            </button>
          </li>
        ))}
        {categories.length === 0 && <li className="category-list-empty">Henuz kategori yok.</li>}
      </ul>
      <h3 className="category-list-title">Tedarikci Ekle</h3>
      <p className="category-form-hint small">
        <strong>Sadece tedarikci adi yeterli</strong> — diger alanlar bos kalabilir; listede <strong>sag tik</strong> ile sonradan
        tamamlarsiniz.
      </p>
      <input placeholder="Tedarikci adi" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
      <input
        placeholder="GSM (opsiyonel)"
        value={supplierExtra.phone}
        onChange={(e) => setSupplierExtra((p) => ({ ...p, phone: e.target.value }))}
      />
      <input
        type="text"
        inputMode="email"
        autoComplete="off"
        placeholder="E-posta (opsiyonel)"
        value={supplierExtra.email}
        onChange={(e) => setSupplierExtra((p) => ({ ...p, email: e.target.value }))}
      />
      <input
        placeholder="Adres (opsiyonel)"
        value={supplierExtra.address}
        onChange={(e) => setSupplierExtra((p) => ({ ...p, address: e.target.value }))}
      />
      <div className="customer-detail-edit-grid">
        <input
          placeholder="Ilce"
          value={supplierExtra.district}
          onChange={(e) => setSupplierExtra((p) => ({ ...p, district: e.target.value }))}
        />
        <input
          placeholder="Il"
          value={supplierExtra.city}
          onChange={(e) => setSupplierExtra((p) => ({ ...p, city: e.target.value }))}
        />
      </div>
      <input
        placeholder="Vergi dairesi (opsiyonel)"
        value={supplierExtra.taxOffice}
        onChange={(e) => setSupplierExtra((p) => ({ ...p, taxOffice: e.target.value }))}
      />
      <input
        placeholder="VKN / TCKN (opsiyonel)"
        value={supplierExtra.taxNumber}
        onChange={(e) => setSupplierExtra((p) => ({ ...p, taxNumber: e.target.value }))}
      />
      <input
        placeholder="Not (opsiyonel)"
        value={supplierExtra.note}
        onChange={(e) => setSupplierExtra((p) => ({ ...p, note: e.target.value }))}
      />
      <button type="button" onClick={() => void submitSupplier()}>
        Tedarikci Kaydet
      </button>
      <h3 className="category-list-title">
        Mevcut tedarikciler
        {supplierDebtTotalKurus > 0 ? (
          <span className="supplier-debt-badge category-supplier-debt-total" title="Toplam tedarikci borcu">
            {formatTry(supplierDebtTotalKurus)}
          </span>
        ) : null}
      </h3>
      <ul className="category-list">
        {suppliers.map((s) => (
          <li
            key={s.id}
            className="category-supplier-row"
            title="Sag tik: iletisim / adres duzenle"
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSupplierEdit(s);
            }}
          >
            <span>
              {s.name}
              {s.balanceOwedKurus > 0 ? (
                <span className="supplier-debt-badge" title="Tedarikciye borc">
                  {formatTry(s.balanceOwedKurus)}
                </span>
              ) : null}
            </span>
            <span className="category-badge">
              {[s.phone, s.email].filter((x) => x.trim()).join(" · ") || "Iletisim yok"}
            </span>
            <button
              type="button"
              className="category-delete-btn"
              title="Tedarikciyi sil (bagli aktif urun olmamali)"
              onClick={() => {
                if (!window.confirm(`"${s.name}" tedarikcisi silinsin mi?`)) return;
                void (async () => {
                  setFormMessage("");
                  try {
                    await getMarinaApi().deleteSupplier(s.id);
                    setFormMessage("Tedarikci silindi.");
                    await onCreated();
                  } catch (error) {
                    setFormMessage(error instanceof Error ? error.message : "Silinemedi.");
                  }
                })();
              }}
            >
              Sil
            </button>
          </li>
        ))}
        {suppliers.length === 0 && <li className="category-list-empty">Henuz tedarikci yok.</li>}
      </ul>

      {categoryEdit ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => {
            if (!categoryEditSaving) setCategoryEdit(null);
          }}
        >
          <div
            className="modal-dialog category-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-edit-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="category-edit-title">Kategori duzenle</h3>
            <label className="settings-field">
              <span>Kategori adi *</span>
              <input value={categoryEditName} onChange={(e) => setCategoryEditName(e.target.value)} disabled={categoryEditSaving} />
            </label>
            <div className="sale-unit-row" role="group" aria-label="Satis turu">
              <label className="sale-unit-option">
                <input
                  type="radio"
                  name="catEditSaleUnit"
                  checked={categoryEditUnit === "piece"}
                  disabled={categoryEditSaving || categoryProductRows.length > 0}
                  onChange={() => setCategoryEditUnit("piece")}
                />
                Adetli satis
              </label>
              <label className="sale-unit-option">
                <input
                  type="radio"
                  name="catEditSaleUnit"
                  checked={categoryEditUnit === "gram"}
                  disabled={categoryEditSaving || categoryProductRows.length > 0}
                  onChange={() => setCategoryEditUnit("gram")}
                />
                Gramajli satis
              </label>
            </div>
            {categoryProductRows.length > 0 ? (
              <p className="category-form-hint small">Bu kategoride urun varken satis birimi degistirilemez.</p>
            ) : null}
            <h4 className="category-list-title">Kategorideki urunler</h4>
            {categoryProductRows.length === 0 ? (
              <p className="category-edit-products-empty">Bu kategoride aktif urun yok.</p>
            ) : (
              <div className="category-edit-products">
                <table>
                  <thead>
                    <tr>
                      <th>Urun</th>
                      <th>{pricePlaceholder(categoryEditUnit)}</th>
                      <th className="category-edit-wholesale-col">Toptan</th>
                      <th>{wholesalePricePlaceholder(categoryEditUnit)}</th>
                      <th>{categoryEditUnit === "gram" ? "Stok (g)" : "Stok"}</th>
                      <th>Ind. %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryProductRows.map((row) => (
                      <tr key={row.productId}>
                        <td>
                          <input
                            value={row.name}
                            disabled={categoryEditSaving}
                            onChange={(e) =>
                              setCategoryProductRows((prev) =>
                                prev.map((r) => (r.productId === row.productId ? { ...r, name: e.target.value } : r))
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            inputMode="decimal"
                            value={row.priceTl}
                            disabled={categoryEditSaving}
                            onChange={(e) =>
                              setCategoryProductRows((prev) =>
                                prev.map((r) => (r.productId === row.productId ? { ...r, priceTl: e.target.value } : r))
                              )
                            }
                          />
                        </td>
                        <td className="category-edit-wholesale-col">
                          <input
                            type="checkbox"
                            checked={row.sellsWholesale}
                            disabled={categoryEditSaving}
                            title="Toptan satisa acik"
                            onChange={(e) =>
                              setCategoryProductRows((prev) =>
                                prev.map((r) =>
                                  r.productId === row.productId
                                    ? { ...r, sellsWholesale: e.target.checked, wholesaleTl: e.target.checked ? r.wholesaleTl : "" }
                                    : r
                                )
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            inputMode="decimal"
                            value={row.wholesaleTl}
                            disabled={categoryEditSaving || !row.sellsWholesale}
                            placeholder={categoryEditUnit === "gram" ? "TL/1000g" : "TL"}
                            onChange={(e) =>
                              setCategoryProductRows((prev) =>
                                prev.map((r) => (r.productId === row.productId ? { ...r, wholesaleTl: e.target.value } : r))
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            inputMode="decimal"
                            value={row.stockQty}
                            disabled={categoryEditSaving}
                            onChange={(e) =>
                              setCategoryProductRows((prev) =>
                                prev.map((r) => (r.productId === row.productId ? { ...r, stockQty: e.target.value } : r))
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            inputMode="decimal"
                            value={row.discountPercent}
                            disabled={categoryEditSaving}
                            onChange={(e) =>
                              setCategoryProductRows((prev) =>
                                prev.map((r) =>
                                  r.productId === row.productId ? { ...r, discountPercent: e.target.value } : r
                                )
                              )
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" disabled={categoryEditSaving} onClick={() => setCategoryEdit(null)}>
                Vazgec
              </button>
              <button type="button" className="primary" disabled={categoryEditSaving} onClick={() => void submitCategoryEdit()}>
                {categoryEditSaving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {supplierEdit ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => {
            if (!supplierEditSaving) setSupplierEdit(null);
          }}
        >
          <div
            className="modal-dialog supplier-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="supplier-edit-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="supplier-edit-title">Tedarikci duzenle</h3>
            <label className="settings-field">
              <span>Ad *</span>
              <input
                value={supplierEditForm.name}
                onChange={(e) => setSupplierEditForm((p) => ({ ...p, name: e.target.value }))}
                disabled={supplierEditSaving}
              />
            </label>
            <label className="settings-field">
              <span>Acik borc (TL)</span>
              <input
                type="text"
                inputMode="decimal"
                value={supplierEditForm.balanceTl}
                onChange={(e) => setSupplierEditForm((p) => ({ ...p, balanceTl: e.target.value }))}
                disabled={supplierEditSaving}
                placeholder="0"
              />
            </label>
            <label className="settings-field">
              <span>GSM</span>
              <input
                value={supplierEditForm.phone}
                onChange={(e) => setSupplierEditForm((p) => ({ ...p, phone: e.target.value }))}
                disabled={supplierEditSaving}
              />
            </label>
            <label className="settings-field">
              <span>E-posta</span>
              <input
                type="email"
                value={supplierEditForm.email}
                onChange={(e) => setSupplierEditForm((p) => ({ ...p, email: e.target.value }))}
                disabled={supplierEditSaving}
              />
            </label>
            <label className="settings-field settings-field-wide">
              <span>Adres</span>
              <input
                value={supplierEditForm.address}
                onChange={(e) => setSupplierEditForm((p) => ({ ...p, address: e.target.value }))}
                disabled={supplierEditSaving}
              />
            </label>
            <div className="customer-detail-edit-grid">
              <label className="settings-field">
                <span>Ilce</span>
                <input
                  value={supplierEditForm.district}
                  onChange={(e) => setSupplierEditForm((p) => ({ ...p, district: e.target.value }))}
                  disabled={supplierEditSaving}
                />
              </label>
              <label className="settings-field">
                <span>Il</span>
                <input
                  value={supplierEditForm.city}
                  onChange={(e) => setSupplierEditForm((p) => ({ ...p, city: e.target.value }))}
                  disabled={supplierEditSaving}
                />
              </label>
            </div>
            <label className="settings-field">
              <span>Vergi dairesi</span>
              <input
                value={supplierEditForm.taxOffice}
                onChange={(e) => setSupplierEditForm((p) => ({ ...p, taxOffice: e.target.value }))}
                disabled={supplierEditSaving}
              />
            </label>
            <label className="settings-field">
              <span>VKN / TCKN</span>
              <input
                value={supplierEditForm.taxNumber}
                onChange={(e) => setSupplierEditForm((p) => ({ ...p, taxNumber: e.target.value }))}
                disabled={supplierEditSaving}
              />
            </label>
            <label className="settings-field">
              <span>Not</span>
              <textarea
                value={supplierEditForm.note}
                onChange={(e) => setSupplierEditForm((p) => ({ ...p, note: e.target.value }))}
                rows={2}
                disabled={supplierEditSaving}
              />
            </label>
            <div className="modal-actions">
              <button type="button" disabled={supplierEditSaving} onClick={() => setSupplierEdit(null)}>
                Vazgec
              </button>
              <button type="button" className="primary" disabled={supplierEditSaving} onClick={() => void submitSupplierEdit()}>
                {supplierEditSaving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}

/** Urun formunda secili kategorideki stok ozeti (sadece gosterim) */
export function CategoryStockHint({ categories, products, categoryId }: { categories: Category[]; products: Product[]; categoryId: number }) {
  if (categoryId <= 0) return null;
  const unit = categorySaleUnitOf(categories, categoryId);
  const same = products.filter((p) => p.categoryId === categoryId && p.isActive === 1);
  if (same.length === 0) {
    return <p className="category-stock-hint">Bu kategoride henuz urun yok. Asagidan ilk urunu ekleyebilirsiniz.</p>;
  }
  return (
    <div className="category-stock-hint-block">
      <p className="category-stock-hint-title">Bu kategorideki urunler ve kalan stok</p>
      <ul className="category-stock-list">
        {same.map((p) => (
          <li key={p.id}>
            <span>{p.name}</span>
            <span>{formatQtyShort(p.stockQty, unit)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
