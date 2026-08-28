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
import { ProductSuppliersField } from "./ProductSuppliersField";
import { normalizeAlternateSupplierIds } from "../../utils/productSuppliers";
import { formatFxTry } from "../../services/fxRates";
import {
  convertTlFormToUsdFields,
  convertUsdFormToTlFields,
  costUsdArrivalPreview,
  getCachedUsdTry,
  parseUsdAmount,
  parseUsdTryRate,
  resolveUsdTryRate,
  usdCentsToTlKurus,
  usdTlPreviewLabel,
  usdToCents
} from "../../utils/usdPricing";

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
  alternateSupplierIds: [] as number[],
  material: "",
  vatRatePercent: "20",
  priceIncludesVat: false,
  domesticMade: false,
  pricedInUsd: false,
  priceUsd: "",
  costUsd: "",
  costUsdTryRate: "",
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
  const [usdTry, setUsdTry] = useState<number | null>(() => getCachedUsdTry());
  /** Kullanici kod alanina dokunduysa barkod blur ile kod ezilmez */
  const codeTouchedRef = useRef(false);

  const saleUnit = useMemo(() => categorySaleUnitOf(categories, form.categoryId), [categories, form.categoryId]);

  useEffect(() => {
    if (!form.pricedInUsd) return;
    void resolveUsdTryRate()
      .then((r) => {
        setUsdTry(r);
        setForm((prev) =>
          prev.pricedInUsd && !String(prev.costUsdTryRate).trim()
            ? { ...prev, costUsdTryRate: r.toFixed(4) }
            : prev
        );
      })
      .catch(() => setUsdTry(getCachedUsdTry()));
  }, [form.pricedInUsd]);

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
    const discountPercent = Number(form.discountPercent || 0);
    const stockRaw = String(form.stockQty).trim();
    const stockQty = stockRaw === "" ? 0 : parseTrAmount(stockRaw);

    let priceTl = 0;
    let costTl = 0;
    let priceUsdCents = 0;
    let costUsdCents = 0;
    let costUsdTryRate = 0;
    let pricedInUsd = false;

    if (form.pricedInUsd) {
      const priceUsd = parseUsdAmount(form.priceUsd);
      const costUsd = parseUsdAmount(String(form.costUsd).trim() === "" ? "0" : form.costUsd);
      const gelisKuru = parseUsdTryRate(form.costUsdTryRate);
      if (
        !name ||
        !code ||
        !barcode ||
        priceUsd == null ||
        priceUsd < 0 ||
        costUsd == null ||
        costUsd < 0 ||
        gelisKuru == null ||
        !Number.isFinite(discountPercent) ||
        discountPercent < 0 ||
        discountPercent > 100 ||
        stockQty == null ||
        stockQty < 0 ||
        form.categoryId <= 0
      ) {
        setFormMessage("Lutfen zorunlu alanlari dogru doldurun (dolar fiyatlari ve gelis kuru dahil).");
        return;
      }
      let liveRate: number;
      try {
        liveRate = await resolveUsdTryRate();
        setUsdTry(liveRate);
      } catch (e) {
        setFormMessage(e instanceof Error ? e.message : "Dolar kuru alinamadi.");
        return;
      }
      pricedInUsd = true;
      priceUsdCents = usdToCents(priceUsd);
      costUsdCents = usdToCents(costUsd);
      costUsdTryRate = gelisKuru;
      priceTl = usdCentsToTlKurus(priceUsdCents, liveRate) / 100;
      costTl = usdCentsToTlKurus(costUsdCents, gelisKuru) / 100;
    } else {
      const priceParsed = parseTrAmount(form.priceTl);
      const costParsed = parseTrAmount(String(form.costTl).trim() === "" ? "0" : form.costTl);
      if (
        !name ||
        !code ||
        !barcode ||
        priceParsed == null ||
        priceParsed < 0 ||
        costParsed == null ||
        costParsed < 0 ||
        !Number.isFinite(discountPercent) ||
        discountPercent < 0 ||
        discountPercent > 100 ||
        stockQty == null ||
        stockQty < 0 ||
        form.categoryId <= 0
      ) {
        setFormMessage("Lutfen zorunlu alanlari dogru doldurun.");
        return;
      }
      priceTl = priceParsed;
      costTl = costParsed;
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
    } else if (stockQty > 0 && !Number.isInteger(stockQty)) {
      setFormMessage("Gramajli urunde stok tam sayi (g) olmalidir.");
      return;
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
      const wholesaleParsed = parseTrAmount(String(form.wholesaleTl).trim() === "" ? "0" : form.wholesaleTl);
      const alternateParsed = parseTrAmount(String(form.alternateTl).trim() === "" ? "0" : form.alternateTl);
      const wholesaleTl = wholesaleParsed ?? 0;
      const alternateTl = alternateParsed ?? 0;
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
        pricedInUsd,
        priceUsdCents,
        costUsdCents,
        costUsdTryRate,
        stockQty: stockRounded,
        ...(initialStockRemainingDebtKurus != null ? { initialStockRemainingDebtKurus } : {}),
        imagePath: form.imagePath.trim(),
        categoryId: form.categoryId,
        supplierId: form.supplierId,
        alternateSupplierIds: normalizeAlternateSupplierIds(form.alternateSupplierIds, form.supplierId),
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

  const stockLabel = saleUnit === "gram" ? "Ilk stok (gram, 0 olabilir)" : "Ilk stok (adet, 0 olabilir)";
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
      <ProductSuppliersField
        suppliers={suppliers}
        primarySupplierId={form.supplierId}
        alternateSupplierIds={form.alternateSupplierIds}
        onChange={(supplierId, alternateSupplierIds) =>
          setForm((prev) => ({ ...prev, supplierId, alternateSupplierIds }))
        }
      />
      <label className="sale-unit-option product-domestic-toggle">
        <input type="checkbox" checked={form.domesticMade} onChange={(e) => setForm({ ...form, domesticMade: e.target.checked })} />
        Yerli uretim
      </label>
      <h3 className="product-form-subheading">Dolar bazli satis</h3>
      <label className="sale-unit-option product-form-checkbox-row">
        <input
          type="checkbox"
          checked={form.pricedInUsd}
          onChange={(e) => {
            const checked = e.target.checked;
            if (!checked && form.pricedInUsd) {
              const tl = convertUsdFormToTlFields({
                priceUsd: form.priceUsd,
                costUsd: form.costUsd,
                costUsdTryRate: form.costUsdTryRate,
                fallbackPriceTl: form.priceTl,
                fallbackCostTl: form.costTl,
                liveUsdTry: usdTry
              });
              setForm({
                ...form,
                pricedInUsd: false,
                priceUsd: "",
                costUsd: "",
                costUsdTryRate: "",
                priceTl: tl.priceTl,
                costTl: tl.costTl
              });
              return;
            }
            if (checked && !form.pricedInUsd) {
              const usd = convertTlFormToUsdFields({
                priceTl: form.priceTl,
                costTl: form.costTl,
                fallbackPriceUsd: form.priceUsd,
                fallbackCostUsd: form.costUsd,
                liveUsdTry: usdTry
              });
              setForm({
                ...form,
                pricedInUsd: true,
                priceUsd: usd.priceUsd,
                costUsd: usd.costUsd,
                costUsdTryRate: form.costUsdTryRate || usd.costUsdTryRate
              });
              return;
            }
            setForm({ ...form, pricedInUsd: checked });
          }}
        />
        <span>Dolar bazli (ithal) — satis guncel kur, gelis kayitli gelis kuru</span>
      </label>
      {form.pricedInUsd ? (
        <>
          <p className="form-note product-form-section-note">
            <strong>Satis</strong> alt bardaki guncel USD/TRY ile hesaplanir
            {usdTry != null ? (
              <>
                {" "}
                (su an <strong>{formatFxTry(usdTry)}</strong>)
              </>
            ) : null}
            . <strong>Gelis</strong> icin asagidaki &quot;hangi kurdan geldi&quot; kuru kaydedilir; maliyet o kurdan
            yuvarlanir.
          </p>
          <input
            type="number"
            step="0.01"
            min={0}
            placeholder={saleUnit === "gram" ? "Satis (USD / 1000 g)" : "Satis fiyati (USD)"}
            value={form.priceUsd}
            onChange={(e) => setForm({ ...form, priceUsd: e.target.value })}
            required
          />
          <p className="form-note">
            Satis TL (guncel kur): {usdTlPreviewLabel(parseUsdAmount(form.priceUsd) ?? 0, usdTry)}
            {saleUnit === "gram" ? " / 1000 g" : ""}
          </p>
          <input
            type="number"
            step="0.0001"
            min={0}
            placeholder="Gelis kuru (USD/TRY) — hangi kurdan geldi"
            value={form.costUsdTryRate}
            onChange={(e) => setForm({ ...form, costUsdTryRate: e.target.value })}
            required
          />
          <p className="form-note">
            <button
              type="button"
              className="linkish"
              disabled={usdTry == null}
              onClick={() => {
                if (usdTry != null) setForm((prev) => ({ ...prev, costUsdTryRate: usdTry.toFixed(4) }));
              }}
            >
              Guncel kuru gelis kuruna yaz
            </button>
          </p>
          <input
            type="number"
            step="0.01"
            min={0}
            placeholder={saleUnit === "gram" ? "Gelis (USD / 1000 g)" : "Gelis / maliyet (USD)"}
            value={form.costUsd}
            onChange={(e) => setForm({ ...form, costUsd: e.target.value })}
          />
          <p className="form-note">
            {costUsdArrivalPreview(
              parseUsdAmount(String(form.costUsd).trim() === "" ? "0" : form.costUsd) ?? 0,
              parseUsdTryRate(form.costUsdTryRate)
            )}
            {saleUnit === "gram" ? " / 1000 g" : ""}
          </p>
        </>
      ) : null}
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
      {!form.pricedInUsd ? (
        <input
          type="number"
          step="0.01"
          placeholder={pricePlaceholder(saleUnit)}
          value={form.priceTl}
          onChange={(e) => setForm({ ...form, priceTl: e.target.value })}
          required
        />
      ) : null}
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
      {!form.pricedInUsd ? (
        <input
          type="text"
          inputMode="decimal"
          placeholder={costPlaceholder(saleUnit)}
          value={form.costTl}
          onChange={(e) => setForm({ ...form, costTl: e.target.value })}
        />
      ) : null}
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
