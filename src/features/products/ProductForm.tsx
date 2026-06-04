import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { getMarinaApi } from "../../api/marinaClient";
import { Category, Product, Supplier } from "../../types/models";
import {
  generateUniqueBarcode13,
  uniqueCodeFromBarcode,
  validateProductBarcodeUnique,
  validateProductCodeUnique
} from "../../utils/productCodes";
import {
  categorySaleUnitOf,
  costPlaceholder,
  costTlPer1000gToCostPriceKurus,
  pricePlaceholder,
  tlPer1000gToKurusPerGram,
  wholesalePricePlaceholder
} from "../../utils/saleUnit";
import { parseTrAmount, tlToKurus } from "../../utils/currency";
import { lineCostKurusFromUnit } from "../../utils/stockCost";
import { CategoryStockHint } from "./CategoryForm";

interface Props {
  categories: Category[];
  suppliers: Supplier[];
  products: Product[];
  onCreated: () => Promise<void>;
}

const initialState = {
  name: "",
  description: "",
  barcode: "",
  code: "",
  priceTl: "",
  discountPercent: "",
  costTl: "",
  stockQty: "",
  imagePath: "",
  categoryId: 0,
  supplierId: 0,
  material: "",
  vatRatePercent: "20",
  priceIncludesVat: false,
  domesticMade: false,
  wholesaleTl: "",
  alternateTl: "",
  posFavorite: false,
  sellsWholesale: false,
  initialRemainingDebtTl: ""
};

export function ProductForm({ categories, suppliers, products, onCreated }: Props) {
  const [form, setForm] = useState(initialState);
  const [formMessage, setFormMessage] = useState("");
  const [mediaDir, setMediaDir] = useState("");
  /** Kullanici kod alanina dokunduysa barkod blur ile kod ezilmez */
  const codeTouchedRef = useRef(false);

  const saleUnit = useMemo(() => categorySaleUnitOf(categories, form.categoryId), [categories, form.categoryId]);

  const applyBarcodeAndCode = () => {
    setFormMessage("");
    try {
      const barcode = generateUniqueBarcode13(products);
      const code = uniqueCodeFromBarcode(barcode, products);
      codeTouchedRef.current = false;
      setForm((prev) => ({ ...prev, barcode, code }));
    } catch (e) {
      setFormMessage(e instanceof Error ? e.message : "Barkod uretilemedi.");
    }
  };

  const syncCodeFromBarcode = (barcodeOverride?: string) => {
    setFormMessage("");
    const b = (barcodeOverride ?? form.barcode).trim();
    if (!b) return;
    try {
      const code = uniqueCodeFromBarcode(b, products);
      setForm((prev) => ({ ...prev, code }));
    } catch {
      setFormMessage("Kod barkoda gore uretilemedi.");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMessage("");
    const name = form.name.trim();
    const code = form.code.trim();
    const barcode = form.barcode.trim();
    const priceTl = Number(form.priceTl);
    const costTl = Number(form.costTl || 0);
    const discountPercent = Number(form.discountPercent || 0);
    const stockQty = Number(String(form.stockQty).replace(",", "."));

    if (
      !name ||
      !code ||
      !barcode ||
      !Number.isFinite(priceTl) ||
      priceTl <= 0 ||
      !Number.isFinite(costTl) ||
      costTl < 0 ||
      !Number.isFinite(discountPercent) ||
      discountPercent < 0 ||
      discountPercent > 100 ||
      !Number.isFinite(stockQty) ||
      stockQty < 0 ||
      form.categoryId <= 0
    ) {
      setFormMessage("Lutfen zorunlu alanlari dogru doldurun.");
      return;
    }

    if (!validateProductBarcodeUnique(barcode, products)) {
      setFormMessage("Bu barkod baska bir urunde kayitli; farkli barkod girin veya barkod uretin.");
      return;
    }
    if (!validateProductCodeUnique(code, products)) {
      setFormMessage("Bu kod baska bir urunde kayitli; farkli kod girin.");
      return;
    }

    if (saleUnit === "piece") {
      if (!Number.isInteger(stockQty)) {
        setFormMessage("Adetli kategoride stok tam sayi olmalidir.");
        return;
      }
    } else {
      if (!Number.isInteger(stockQty)) {
        setFormMessage("Gramajli urunde stok tam sayi (g) olmalidir.");
        return;
      }
      if (stockQty === 0) {
        setFormMessage("Gramajli urunde stok 0 olamaz (en az kucuk bir miktar girin).");
        return;
      }
    }

    let initialStockRemainingDebtKurus: number | undefined;
    const stockRounded = Math.round(stockQty);
    const costPriceKurus =
      saleUnit === "gram" ? costTlPer1000gToCostPriceKurus(costTl) : tlToKurus(costTl);
    if (stockRounded > 0 && costPriceKurus > 0 && String(form.initialRemainingDebtTl).trim() !== "") {
      const debtParsed = parseTrAmount(form.initialRemainingDebtTl);
      if (debtParsed == null || !Number.isFinite(debtParsed) || debtParsed < 0) {
        setFormMessage("Kalan borc gecersiz.");
        return;
      }
      initialStockRemainingDebtKurus = tlToKurus(debtParsed);
      const lineCost = lineCostKurusFromUnit(costPriceKurus, stockRounded, saleUnit);
      if (initialStockRemainingDebtKurus > lineCost) {
        setFormMessage("Kalan borc alis tutarindan fazla olamaz.");
        return;
      }
      if (initialStockRemainingDebtKurus > 0 && form.supplierId <= 0) {
        setFormMessage("Borc icin tedarikci secin.");
        return;
      }
    }

    try {
      const vat = Number(form.vatRatePercent || 20);
      const wholesaleTl = Number(String(form.wholesaleTl).replace(",", "."));
      const alternateTl = Number(String(form.alternateTl).replace(",", "."));
      if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
        setFormMessage("KDV orani 0-100 arasinda olmalidir.");
        return;
      }
      await getMarinaApi().createProduct({
        name,
        description: form.description.trim(),
        barcode,
        code,
        priceKurus: saleUnit === "gram" ? tlPer1000gToKurusPerGram(priceTl) : tlToKurus(priceTl),
        discountPercent,
        costPriceKurus,
        stockQty: stockRounded,
        ...(initialStockRemainingDebtKurus != null ? { initialStockRemainingDebtKurus } : {}),
        imagePath: form.imagePath.trim(),
        categoryId: form.categoryId,
        supplierId: form.supplierId,
        material: form.material.trim(),
        vatRatePercent: vat,
        priceIncludesVat: form.priceIncludesVat,
        domesticMade: form.domesticMade,
        wholesalePriceKurus:
          form.sellsWholesale && Number.isFinite(wholesaleTl) && wholesaleTl > 0
            ? saleUnit === "gram"
              ? tlPer1000gToKurusPerGram(wholesaleTl)
              : tlToKurus(wholesaleTl)
            : 0,
        alternatePriceKurus:
          Number.isFinite(alternateTl) && alternateTl > 0
            ? saleUnit === "gram"
              ? tlPer1000gToKurusPerGram(alternateTl)
              : tlToKurus(alternateTl)
            : 0,
        posFavorite: form.posFavorite ? 1 : 0
      });
      setForm(initialState);
      codeTouchedRef.current = false;
      setFormMessage("Urun kaydedildi.");
      await onCreated();
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Kayit sirasinda bir hata olustu.");
    }
  };

  const selectImage = async () => {
    const selectedPath = await getMarinaApi().selectImage(form.name.trim() || "urun");
    if (!selectedPath) return;
    setForm((prev) => ({ ...prev, imagePath: selectedPath }));
  };

  useEffect(() => {
    const api = getMarinaApi();
    if (typeof api.getMediaDirectory !== "function") return;
    void api.getMediaDirectory().then((dir) => setMediaDir(String(dir ?? ""))).catch(() => setMediaDir(""));
  }, []);

  const stockLabel = saleUnit === "gram" ? "Ilk stok (gram, tam sayi)" : "Ilk stok (adet)";
  const stockStep = "1";

  return (
    <motion.form
      className="product-form"
      onSubmit={(e) => void submit(e)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h2>Yeni Urun Ekle</h2>
      <input placeholder="Urun adi" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      <input placeholder="Aciklama" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <select
        value={form.categoryId}
        onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}
        required
      >
        <option value={0} disabled>
          Kategori sec
        </option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name} ({category.saleUnit === "gram" ? "gram" : "adet"})
          </option>
        ))}
      </select>
      <CategoryStockHint categories={categories} products={products} categoryId={form.categoryId} />
      <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: Number(e.target.value) })}>
        <option value={0}>Tedarikci sec (opsiyonel)</option>
        {suppliers.map((supplier) => (
          <option key={supplier.id} value={supplier.id}>
            {supplier.name}
          </option>
        ))}
      </select>
      <label className="sale-unit-option product-domestic-toggle">
        <input type="checkbox" checked={form.domesticMade} onChange={(e) => setForm({ ...form, domesticMade: e.target.checked })} />
        Yerli uretim
      </label>
      <div className="image-input-row">
        <input
          placeholder="Barkod"
          value={form.barcode}
          onChange={(e) => setForm({ ...form, barcode: e.target.value })}
          onBlur={(e) => {
            if (codeTouchedRef.current) return;
            const b = e.target.value.trim();
            if (b.length >= 8) syncCodeFromBarcode(b);
          }}
          required
        />
        <button type="button" onClick={() => applyBarcodeAndCode()}>
          Barkod Uret
        </button>
      </div>
      <div className="image-input-row">
        <input
          placeholder="Kod (barkoda gore otomatik; elle de girebilirsiniz)"
          value={form.code}
          onChange={(e) => {
            codeTouchedRef.current = e.target.value.trim().length > 0;
            setForm({ ...form, code: e.target.value });
          }}
          required
        />
        <button
          type="button"
          onClick={() => {
            codeTouchedRef.current = false;
            syncCodeFromBarcode();
          }}
        >
          Kodu barkoda gore
        </button>
      </div>
      <input
        type="number"
        step="0.01"
        placeholder={pricePlaceholder(saleUnit)}
        value={form.priceTl}
        onChange={(e) => setForm({ ...form, priceTl: e.target.value })}
        required
      />
      <input placeholder="Malzeme / tedarik notu" value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} />
      <div className="sale-unit-row" role="group" aria-label="KDV">
        <label className="sale-unit-option">
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={form.vatRatePercent}
            onChange={(e) => setForm({ ...form, vatRatePercent: e.target.value })}
          />
          <span>KDV %</span>
        </label>
        <label className="sale-unit-option">
          <input
            type="checkbox"
            checked={form.priceIncludesVat}
            onChange={(e) => setForm({ ...form, priceIncludesVat: e.target.checked })}
          />
          Fiyat KDV dahil
        </label>
      </div>
      <h3 className="product-form-subheading">Toptan satis</h3>
      <label className="sale-unit-option product-form-checkbox-row">
        <input
          type="checkbox"
          checked={form.sellsWholesale}
          onChange={(e) =>
            setForm({
              ...form,
              sellsWholesale: e.target.checked,
              wholesaleTl: e.target.checked ? form.wholesaleTl : ""
            })
          }
        />
        <span>Toptan satisa acik (toptanci musterilere farkli fiyat)</span>
      </label>
      {form.sellsWholesale ? (
        <>
          <p className="form-note product-form-section-note">
            {saleUnit === "gram"
              ? "Sepette Toptan seciliyken bu TL / 1000 g birim fiyat uygulanir. Bos birakilirsa perakende / 1000 g kullanilir."
              : "Sepette Toptan seciliyken bu birim fiyat uygulanir. Bos birakilirsa perakende fiyat kullanilir."}
          </p>
          <input
            type="number"
            step="0.01"
            min={0}
            placeholder={wholesalePricePlaceholder(saleUnit)}
            value={form.wholesaleTl}
            onChange={(e) => setForm({ ...form, wholesaleTl: e.target.value })}
          />
        </>
      ) : null}
      <h3 className="product-form-subheading">Kart ile odeme fiyati</h3>
      <p className="form-note product-form-section-note">
        {saleUnit === "gram" ? (
          <>
            POS sepetinde odeme <strong>Kart</strong> seciliyken bu TL / <strong>1000 g</strong> birim fiyat uygulanir (orn. liste
            1000 g 100 TL, kart 110 TL). Bos birakilirsa liste fiyati kullanilir.
          </>
        ) : (
          <>
            POS sepetinde odeme <strong>Kart</strong> seciliyken bu birim fiyat uygulanir (orn. liste 100 TL, kart 110 TL). Bos
            birakilirsa liste fiyati kullanilir.
          </>
        )}
      </p>
      <input
        type="number"
        step="0.01"
        min={0}
        placeholder="Kart fiyati (TL, bos birakilabilir)"
        value={form.alternateTl}
        onChange={(e) => setForm({ ...form, alternateTl: e.target.value })}
      />
      <h3 className="product-form-subheading">Diger</h3>
      <label className="sale-unit-option product-form-checkbox-row">
        <input
          type="checkbox"
          checked={form.posFavorite}
          onChange={(e) => setForm({ ...form, posFavorite: e.target.checked })}
        />
        <span>Favori satis (POS ust serit)</span>
      </label>
      <input
        type="number"
        min={0}
        max={100}
        step="0.01"
        placeholder="Indirim (%)"
        value={form.discountPercent}
        onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
      />
      <input
        type="number"
        step="0.01"
        min={0}
        placeholder={costPlaceholder(saleUnit)}
        value={form.costTl}
        onChange={(e) => setForm({ ...form, costTl: e.target.value })}
      />
      <input
        type="number"
        min={0}
        step={stockStep}
        placeholder={stockLabel}
        value={form.stockQty === "" ? "" : form.stockQty}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") {
            setForm({ ...form, stockQty: "" });
            return;
          }
          setForm({ ...form, stockQty: saleUnit === "gram" ? String(Math.max(0, Math.round(Number(v) || 0))) : v });
        }}
        required
      />
      {form.supplierId > 0 && Number(form.stockQty) > 0 && Number(form.costTl || 0) >= 0 ? (
        <label className="product-form-debt-field">
          <span>Kalan borc (TL)</span>
          <input
            type="text"
            inputMode="decimal"
            value={form.initialRemainingDebtTl}
            onChange={(e) => setForm({ ...form, initialRemainingDebtTl: e.target.value })}
            placeholder="Bos = tam odendi"
            autoComplete="off"
          />
          <span className="form-note">
            Alisin odenmeyen kismi tedarikci borcuna eklenir. Bu ekrandan gider yazilmaz; odeme kaydi icin Stok → Stok ekle kullanin.
          </span>
        </label>
      ) : null}
      <p className="form-note product-form-section-note">
        <strong>Urun Ekle</strong> yalnizca kart ve ilk stok kaydi acar; <strong>gelir/gider</strong> listesine yazmaz. Odenen
        alimlari <strong>Mal alimi / stok</strong> gidere yansitmak icin <strong>Stok → Stok ekle</strong> kullanin.
      </p>
      <div className="image-input-row">
        <input placeholder="Resim yolu (opsiyonel)" value={form.imagePath} onChange={(e) => setForm({ ...form, imagePath: e.target.value })} />
        <button type="button" onClick={() => void selectImage()}>
          Resim Sec
        </button>
      </div>
      {mediaDir ? <p className="form-message form-note">Resimler otomatik kaydedilir: {mediaDir}</p> : null}
      {formMessage && <p className="form-message">{formMessage}</p>}
      <button type="submit">Kaydet</button>
    </motion.form>
  );
}
