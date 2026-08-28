import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import JsBarcode from "jsbarcode";
import { getMarinaApi } from "../../api/marinaClient";
import type { CategorySaleUnit, Product, Settings } from "../../types/models";
import { formatTry, parseTrAmount, tlToKurus } from "../../utils/currency";
import { formatTlPer1000g, kurusPerGramToTlPer1000g, tlPer1000gToKurusPerGram } from "../../utils/saleUnit";
import {
  BARCODE_LABEL_FIELD_META,
  PRODUCT_NAME_BLACK_META,
  type BarcodeLabelFieldFlags,
  type BarcodeLabelFieldId,
  countLeftDetailLines,
  loadBarcodeLabelFields,
  saveBarcodeLabelFields
} from "./barcodeLabelFields";
import {
  BARCODE_LABEL_SIZES,
  type BarcodeLabelSizeId,
  barcodeHeightForLabelLayout,
  fitPriceFontMm,
  fontsForLabelLayout,
  formatLabelSizeMm,
  getBarcodeLabelSize,
  loadBarcodeLabelSizeId,
  resolveBarcodeLabelLayoutScale,
  saveBarcodeLabelSizeId
} from "./barcodeLabelSizes";
import yerliUretimLogoSrc from "../../assets/yerli-uretim.png";

interface Props {
  product: Product | null;
  /** Gram urunlerde fiyat TL / 1000 g olarak gosterilir ve kaydedilir */
  categorySaleUnit?: CategorySaleUnit;
  settings: Settings | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
}

type BarcodeRenderMode = "preview" | "label";

function renderBarcode(
  svg: SVGSVGElement,
  value: string,
  mode: BarcodeRenderMode = "preview",
  labelHeight = 36,
  barWidth = 1.55
) {
  const raw = value.trim();
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  if (!raw) {
    svg.innerHTML = '<text x="10" y="20" fill="#888">Barkod yok</text>';
    return;
  }
  const opts =
    mode === "label"
      ? {
          width: barWidth,
          height: labelHeight,
          displayValue: true,
          fontSize: labelHeight >= 48 ? 14 : labelHeight >= 32 ? 11 : 9,
          textMargin: 1,
          margin: 0,
          marginTop: 0,
          marginBottom: 0,
          marginLeft: 0,
          marginRight: 0,
          background: "#ffffff",
          lineColor: "#000000"
        }
      : {
          width: Math.max(1.4, barWidth * 0.95),
          height: labelHeight,
          displayValue: true,
          fontSize: labelHeight >= 48 ? 12 : labelHeight >= 30 ? 10 : 8,
          textMargin: 1,
          margin: 0,
          background: "#ffffff",
          lineColor: "#000000"
        };
  try {
    if (/^\d{13}$/.test(raw)) {
      JsBarcode(svg, raw, { ...opts, format: "EAN13" });
      return;
    }
    if (/^\d{8}$/.test(raw)) {
      JsBarcode(svg, raw, { ...opts, format: "EAN8" });
      return;
    }
    JsBarcode(svg, raw, { ...opts, format: "CODE128" });
  } catch {
    try {
      JsBarcode(svg, raw, { ...opts, format: "CODE128" });
    } catch {
      svg.innerHTML = '<text x="10" y="20" fill="#c44">Barkod uretilemedi</text>';
    }
  }
}

function labelPriceDigits(priceTlRaw: string | number): string {
  const n = typeof priceTlRaw === "number" ? priceTlRaw : Number(String(priceTlRaw).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return "0.00";
  return n.toFixed(2);
}

let yerliLogoDataUrlCache: string | null = null;

async function getYerliLogoDataUrl(): Promise<string> {
  if (yerliLogoDataUrlCache) return yerliLogoDataUrlCache;
  if (yerliUretimLogoSrc.startsWith("data:")) {
    yerliLogoDataUrlCache = yerliUretimLogoSrc;
    return yerliLogoDataUrlCache;
  }
  const res = await fetch(yerliUretimLogoSrc);
  const blob = await res.blob();
  yerliLogoDataUrlCache = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error ?? new Error("Logo okunamadi"));
    fr.readAsDataURL(blob);
  });
  return yerliLogoDataUrlCache;
}

function domesticBadgeHtml(logoDataUrl: string, logoHeight: string): string {
  return `<div class="dom-badge" aria-label="Yerli uretim">
  <img class="dom-logo" src="${logoDataUrl}" alt="Yerli Uretim" style="height:${logoHeight};width:auto;display:block;" />
</div>`;
}

/** JsBarcode px boyutlari buyuk (100x100) etikette baski motorunu bozabiliyor */
function barcodeSvgForPrint(barcodeValue: string, labelHeight: number, barWidth: number): string {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "bc");
  renderBarcode(svg, barcodeValue, "label", labelHeight, barWidth);
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  return svg.outerHTML;
}

function formatPriceDate(iso: string) {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function originLabel(domestic: boolean): string {
  return domestic ? "Mensei : Turkiye" : "Mensei : Ithal";
}

function unitPriceLineText(priceDigits: string, unit: CategorySaleUnit): string {
  if (unit === "gram") return `1000 g = ${priceDigits} TL`;
  return `1 Adet = ${Math.round(Number(priceDigits))} TL`;
}

function vatStackLines(includesVat: boolean, vatPct: number): string[] {
  return includesVat ? ["KDV", "Dahil", "TL"] : ["KDV", `%${vatPct}`, "+", "TL"];
}

function escapeHtml(raw: string): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function BarcodePrintModal({ product, categorySaleUnit = "piece", settings, open, onClose, onSaved }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [msg, setMsg] = useState("");
  const [yerliLogoDataUrl, setYerliLogoDataUrl] = useState<string>(yerliUretimLogoSrc);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftCode, setDraftCode] = useState("");
  const [draftBarcode, setDraftBarcode] = useState("");
  const [draftPriceTl, setDraftPriceTl] = useState("");
  const [draftVatPercent, setDraftVatPercent] = useState("20");
  const [draftPriceIncludesVat, setDraftPriceIncludesVat] = useState(false);
  const [draftDomesticMade, setDraftDomesticMade] = useState(false);
  const [labelFields, setLabelFields] = useState<BarcodeLabelFieldFlags>(() => loadBarcodeLabelFields());
  const [labelSizeId, setLabelSizeId] = useState<BarcodeLabelSizeId>(() => loadBarcodeLabelSizeId());

  useEffect(() => {
    if (!product) return;
    setEditMode(false);
    setSaving(false);
    setPrinting(false);
    setMsg("");
    setDraftName(product.name ?? "");
    setDraftDescription(product.description ?? "");
    setDraftCode(product.code ?? "");
    setDraftBarcode(product.barcode ?? "");
    setDraftPriceTl(
      categorySaleUnit === "gram" ? kurusPerGramToTlPer1000g(product.priceKurus).toFixed(2) : (product.priceKurus / 100).toFixed(2)
    );
    setDraftVatPercent(String(product.vatRatePercent ?? 20));
    setDraftPriceIncludesVat(product.priceIncludesVat !== false);
    setDraftDomesticMade(product.domesticMade === true);
  }, [product, open, categorySaleUnit]);

  useEffect(() => {
    if (!open) return;
    setLabelFields(loadBarcodeLabelFields());
    setLabelSizeId(loadBarcodeLabelSizeId());
    void getYerliLogoDataUrl()
      .then((url) => setYerliLogoDataUrl(url))
      .catch(() => setYerliLogoDataUrl(yerliUretimLogoSrc));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const toggleField = (id: BarcodeLabelFieldId) => {
    setLabelFields((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        saveBarcodeLabelFields(next);
      } catch (e) {
        console.error("Etiket alan tercihi kaydedilemedi", e);
      }
      return next;
    });
  };

  const selectSize = (id: BarcodeLabelSizeId) => {
    setLabelSizeId(id);
    try {
      saveBarcodeLabelSizeId(id);
    } catch (e) {
      console.error("Etiket boyutu kaydedilemedi", e);
    }
  };

  const labelSize = getBarcodeLabelSize(labelSizeId);
  const draftVat = Number(draftVatPercent || 20);
  const isDomestic = editMode ? draftDomesticMade : product?.domesticMade === true;
  const leftLines = countLeftDetailLines(labelFields, Boolean(isDomestic));
  const hasDescriptionContent = Boolean(
    labelFields.description && (editMode ? draftDescription : product?.description)?.trim()
  );
  const layoutScale = resolveBarcodeLabelLayoutScale(hasDescriptionContent, leftLines, labelSize.id);
  const layoutFonts = fontsForLabelLayout(labelSize, layoutScale, leftLines);
  const barcodeH = barcodeHeightForLabelLayout(labelSize, layoutScale, leftLines);

  const labelView = useMemo(() => {
    if (!product) return null;
    const name = (editMode ? draftName : product.name).trim() || product.name;
    const description = (editMode ? draftDescription : product.description ?? "").trim();
    const barcodeValue = (editMode ? draftBarcode : product.barcode).trim();
    const priceTlNum =
      categorySaleUnit === "gram"
        ? editMode
          ? Number(String(draftPriceTl).replace(",", ".")) || 0
          : kurusPerGramToTlPer1000g(product.priceKurus)
        : editMode
          ? Number(String(draftPriceTl).replace(",", ".")) || 0
          : product.priceKurus / 100;
    const priceDigits = labelPriceDigits(priceTlNum);
    const includesVat = editMode ? draftPriceIncludesVat : product.priceIncludesVat !== false;
    const vatPct = editMode ? (Number.isFinite(draftVat) ? draftVat : 20) : product.vatRatePercent ?? 20;
    const priceDate = formatPriceDate(product.lastPriceChangeAt);
    const companyName = ((settings?.companyName ?? "").trim() || "Marina Nargile").toLocaleUpperCase("tr-TR");
    return {
      name,
      description,
      barcodeValue,
      priceDigits,
      includesVat,
      vatPct,
      priceDate,
      companyName,
      isDomestic: Boolean(isDomestic),
      vatLines: vatStackLines(includesVat, vatPct)
    };
  }, [
    product,
    editMode,
    draftName,
    draftDescription,
    draftBarcode,
    draftPriceTl,
    draftPriceIncludesVat,
    draftVat,
    categorySaleUnit,
    settings?.companyName,
    isDomestic
  ]);

  useLayoutEffect(() => {
    if (!open || !labelView || !labelFields.barcode) return;
    const svg = svgRef.current;
    if (!svg) return;
    try {
      renderBarcode(svg, labelView.barcodeValue, "label", barcodeH, labelSize.barcode.barWidth);
    } catch (e) {
      console.error("Barkod onizleme hatasi", e);
    }
  }, [open, labelView, labelFields.barcode, barcodeH, labelSize.barcode.barWidth]);

  if (!open || !product || !labelView) return null;

  const company = (settings?.companyName ?? "").trim() || "Marina Nargile";
  const vatNote = product.priceIncludesVat ? "KDV dahil" : `KDV %${product.vatRatePercent ?? 20} (+)`;
  const domestic = product.domesticMade ? "Yerli uretim" : "Ithal / diger";
  const vatNoteDraft = draftPriceIncludesVat ? "KDV dahil" : `KDV %${Number.isFinite(draftVat) ? draftVat : 20} (+)`;
  const f = labelFields;
  const showDescription = hasDescriptionContent;
  const nameFs = layoutFonts.name;
  const priceFs = fitPriceFontMm(layoutFonts.price, labelView.priceDigits, labelSize.id);
  const detailFs = layoutFonts.detail;
  const companyFs = layoutFonts.company;
  const isSquareLabel = labelSize.id === "100x100";

  const buildLabelPrintHtml = (logoDataUrl = yerliLogoDataUrl): string | null => {
    const { name, description, barcodeValue, priceDigits, includesVat, vatPct, priceDate, companyName } = labelView;
    if (f.barcode && !barcodeValue) {
      setMsg("Barkod bos; once barkod girin veya duzenleyin.");
      return null;
    }
    const vatStack = includesVat
      ? "<span>KDV</span><span>Dahil</span><span>TL</span>"
      : `<span>KDV</span><span>%${vatPct}</span><span>+</span><span>TL</span>`;
    const w = labelSize.widthMm;
    const h = labelSize.heightMm;

    const leftBits: string[] = [];
    if (f.domesticBadge && labelView.isDomestic) {
      leftBits.push(domesticBadgeHtml(logoDataUrl, labelSize.domLogoHeight));
    }
    if (f.unitPriceLine) {
      leftBits.push(`<div class="detail">${escapeHtml(unitPriceLineText(priceDigits, categorySaleUnit))}</div>`);
    }
    if (f.origin) leftBits.push(`<div class="detail">${escapeHtml(originLabel(labelView.isDomestic))}</div>`);
    if (f.fdt && priceDate !== "—") leftBits.push(`<div class="detail">${escapeHtml(`FDT : ${priceDate}`)}</div>`);

    // Baski icin her seferinde uret — onizleme SVG'sinin px boyutu 100x100'de surucuyu bozabiliyor
    let barcodeMarkup = "";
    if (f.barcode) {
      barcodeMarkup = barcodeSvgForPrint(barcodeValue, barcodeH, labelSize.barcode.barWidth);
    }

    const squarePrintLayout = isSquareLabel
      ? `
  .label.is-square {
    display: grid;
    grid-template-rows: auto auto 1fr;
    align-content: start;
    gap: ${labelSize.gap};
  }
  .label.is-square .top { grid-row: 1; }
  .label.is-square .foot {
    grid-row: 2 / 4;
    display: grid;
    grid-template-rows: auto 1fr;
    gap: ${labelSize.gap};
    min-height: 0;
  }
  .label.is-square .bc-wrap {
    align-self: end;
    max-height: none;
    padding-top: 1mm;
  }
  .label.is-square .bc-wrap svg {
    max-height: 30mm;
  }`
      : "";

    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Barkod Etiket</title>
<style>
  @page { size: ${w}mm ${h}mm; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  html, body {
    margin: 0; padding: 0;
    width: ${w}mm; height: ${h}mm;
    overflow: hidden; background: #fff; color: #000;
    font-family: Arial, Helvetica, "Segoe UI", sans-serif;
  }
  @media print {
    @page { size: ${w}mm ${h}mm; margin: 0; }
    html, body {
      width: ${w}mm !important;
      height: ${h}mm !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      opacity: 1 !important;
      visibility: visible !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .label {
      width: ${w}mm !important;
      height: ${h}mm !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
  }
  .label {
    width: ${w}mm; height: ${h}mm;
    padding: ${labelSize.padding};
    display: flex; flex-direction: column;
    justify-content: flex-start;
    gap: ${labelSize.gap};
    overflow: hidden;
    background: #fff;
  }
  .top {
    display: flex;
    flex-direction: column;
    gap: ${labelSize.gap};
    flex: 0 0 auto;
    min-height: 0;
    overflow: hidden;
  }
  .name {
    margin: 0;
    text-align: center;
    font-size: ${nameFs};
    font-weight: 800;
    line-height: 1.08;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    max-height: ${isSquareLabel ? "2.4em" : "3.2em"};
    overflow: hidden;
    word-break: break-word;
    color: #111;
    padding: 0;
    width: 100%;
    box-sizing: border-box;
  }
  .name.is-black {
    background: #000 !important;
    color: #fff !important;
    padding: 0.35mm 0.8mm;
  }
  .name.hidden { display: none; }
  .desc {
    margin: 0 0 ${labelSize.descGap};
    text-align: center;
    font-size: ${labelSize.fonts.desc};
    font-weight: 600;
    line-height: 1.2;
    max-height: ${isSquareLabel ? "2.6em" : "3.6em"};
    overflow: hidden;
    word-break: break-word;
    color: #111;
  }
  .foot {
    margin-top: 0;
    display: flex;
    flex-direction: column;
    gap: ${labelSize.gap};
    flex: 0 0 auto;
    width: 100%;
    overflow: visible;
  }
  .mid {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: ${isSquareLabel ? "2mm" : "1.2mm"};
    margin: 0;
    min-height: 0;
    flex: 0 1 auto;
    width: 100%;
    overflow: hidden;
  }
  .mid-left {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-end;
    gap: 0.35mm;
    flex: 1 1 ${isSquareLabel ? "34%" : "46%"};
    max-width: ${isSquareLabel ? "36%" : "48%"};
    min-width: 0;
    overflow: hidden;
  }
  .mid-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: flex-end;
    gap: 0.2mm;
    flex: 0 1 ${isSquareLabel ? "62%" : "50%"};
    max-width: ${isSquareLabel ? "64%" : "52%"};
    min-width: 0;
    overflow: visible;
    padding-right: ${isSquareLabel ? "0.4mm" : "0"};
    box-sizing: border-box;
  }
  .dom-badge {
    display: block;
    line-height: 0;
    margin: 0;
    padding: 0;
    border: none;
  }
  .dom-logo {
    height: ${labelSize.domLogoHeight};
    width: auto;
    max-width: 100%;
    display: block;
    object-fit: contain;
  }
  .detail {
    font-size: ${detailFs};
    font-weight: 700;
    letter-spacing: 0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    line-height: 1.1;
  }
  .company {
    margin: 0;
    text-align: center;
    font-size: ${companyFs};
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    width: 100%;
    line-height: 1.1;
  }
  .price-block {
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    gap: ${isSquareLabel ? "0.45mm" : "0.8mm"};
    max-width: 100%;
    box-sizing: border-box;
  }
  .price-num {
    font-size: ${priceFs};
    font-weight: 800;
    line-height: 1;
    letter-spacing: ${isSquareLabel ? "-0.04em" : "-0.03em"};
    font-variant-numeric: tabular-nums;
    max-width: ${isSquareLabel ? "calc(100% - 7mm)" : "100%"};
    overflow: visible;
    flex: 0 1 auto;
    min-width: 0;
    white-space: nowrap;
  }
  .price-vat {
    display: flex;
    flex-direction: column;
    font-size: ${labelSize.fonts.vat};
    font-weight: 700;
    line-height: 1.02;
    padding-bottom: 0.2mm;
    flex: 0 0 auto;
  }
  .gram-hint {
    font-size: ${labelSize.fonts.gram};
    font-weight: 700;
    text-align: right;
  }
  .bc-wrap {
    margin: 0;
    padding-top: ${isSquareLabel ? "0.8mm" : "0.45mm"};
    text-align: center;
    line-height: 0;
    flex: 0 0 auto;
    width: 100%;
    max-height: ${isSquareLabel ? "28mm" : "none"};
    overflow: visible;
  }
  .bc-wrap svg {
    max-width: 100%;
    width: 100%;
    height: auto;
    max-height: ${isSquareLabel ? "30mm" : "none"};
    display: block;
    margin: 0 auto;
  }
  .hidden { display: none !important; }
${squarePrintLayout}
</style></head><body>
<div class="label${isSquareLabel ? " is-square" : ""}">
  <div class="top">
    ${f.companyName ? `<div class="company">${escapeHtml(companyName)}</div>` : ""}
    <div class="name ${f.productName ? "" : "hidden"}${f.productName && f.productNameBlack ? " is-black" : ""}">${escapeHtml(name)}</div>
    ${showDescription ? `<div class="desc">${escapeHtml(description)}</div>` : ""}
  </div>
  <div class="foot">
    <div class="mid">
      <div class="mid-left">
        ${leftBits.join("")}
      </div>
      <div class="mid-right">
        <div class="price-block ${f.price || f.vatStack ? "" : "hidden"}">
          <div class="price-num ${f.price ? "" : "hidden"}">${escapeHtml(priceDigits)}</div>
          <div class="price-vat ${f.vatStack ? "" : "hidden"}">${vatStack}</div>
        </div>
        ${categorySaleUnit === "gram" && f.price ? '<div class="gram-hint">/ 1000 g</div>' : ""}
      </div>
    </div>
    <div class="bc-wrap ${f.barcode ? "" : "hidden"}">${barcodeMarkup}</div>
  </div>
</div>
</body></html>`;
  };

  const printViaIframe = (html: string, w: number, h: number) =>
    new Promise<void>((resolve, reject) => {
      const frame = document.createElement("iframe");
      frame.setAttribute("title", "Barkod yazdir");
      // Ekran disi + tam opak — dusuk opacity baskida bos/beyaz etiket yapabiliyor
      frame.style.cssText = [
        "position:fixed",
        "left:0",
        "top:0",
        `width:${w}mm`,
        `height:${h}mm`,
        "border:0",
        "opacity:1",
        "visibility:visible",
        "pointer-events:none",
        "transform:translateX(-200vw)",
        "z-index:2147483646",
        "background:#fff"
      ].join(";");
      document.body.appendChild(frame);
      const doc = frame.contentDocument;
      const win = frame.contentWindow;
      if (!doc || !win) {
        frame.remove();
        reject(new Error("Yazdirma penceresi acilamadi."));
        return;
      }

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        try {
          frame.remove();
        } catch {
          /* ignore */
        }
      };

      const waitImages = () => {
        const imgs = Array.from(doc.images ?? []);
        if (imgs.length === 0) return Promise.resolve();
        return Promise.all(
          imgs.map(
            (img) =>
              new Promise<void>((res) => {
                if (img.complete) {
                  res();
                  return;
                }
                img.onload = () => res();
                img.onerror = () => res();
              })
          )
        ).then(() => undefined);
      };

      const triggerPrint = () => {
        try {
          win.addEventListener("afterprint", cleanup, { once: true });
          window.setTimeout(cleanup, 180000);
          win.focus();
          win.print();
          window.setTimeout(() => resolve(), 500);
        } catch (e) {
          cleanup();
          reject(e instanceof Error ? e : new Error("Yazdirma basarisiz."));
        }
      };

      let started = false;
      const start = () => {
        if (started) return;
        started = true;
        void waitImages()
          .then(() => window.setTimeout(triggerPrint, 300))
          .catch(() => window.setTimeout(triggerPrint, 300));
      };

      frame.onload = start;
      frame.srcdoc = html;
      window.setTimeout(start, 500);
    });

  const handlePrint = () => {
    if (printing) return;
    void (async () => {
      setPrinting(true);
      setMsg("Yazici penceresi aciliyor...");
      try {
        let logoUrl = yerliLogoDataUrl;
        try {
          logoUrl = await getYerliLogoDataUrl();
          setYerliLogoDataUrl(logoUrl);
        } catch {
          /* onizleme URL ile devam */
        }
        const html = buildLabelPrintHtml(logoUrl);
        if (!html) {
          setMsg((m) => m || "Yazdirilacak etiket olusturulamadi.");
          return;
        }
        const w = labelSize.widthMm;
        const h = labelSize.heightMm;

        const api = getMarinaApi();
        let electronError = "";
        // Electron: tam mm boyutu gonder — iframe window.print() yazici surucusunde bos etiket yapabiliyor
        if (typeof api.printHtml === "function") {
          const result = await api.printHtml(html, { widthMm: w, heightMm: h, title: "Barkod Etiket" });
          if (result?.ok === true) {
            setMsg("");
            return;
          }
          if (result && result.ok === false && /iptal|cancel/i.test(result.error || "")) {
            setMsg("Yazdirma iptal edildi.");
            return;
          }
          electronError = result && result.ok === false ? result.error : "";
          console.warn("Electron yazdirma basarisiz, iframe deneniyor:", result);
        }

        try {
          await printViaIframe(html, w, h);
          setMsg("");
          return;
        } catch (iframeErr) {
          console.warn("iframe yazdirma basarisiz:", iframeErr);
        }

        throw new Error(
          electronError ||
            "Yazdirma basarisiz. Yazicida kâgit boyutu secilen etiketle ayni olmali (orn. 60x40 mm), olcek %100."
        );
      } catch (e) {
        console.error("Barkod yazdirma hatasi", e);
        const text = e instanceof Error ? e.message : "Yazdirma basarisiz.";
        setMsg(text);
        window.alert(`Barkod yazdirilamadi: ${text}`);
      } finally {
        setPrinting(false);
      }
    })();
  };

  const saveEdits = async () => {
    if (!product) return;
    const name = draftName.trim();
    const code = draftCode.trim();
    const barcode = draftBarcode.trim();
    const priceTl = parseTrAmount(String(draftPriceTl).trim());
    const vatRatePercent = Number(draftVatPercent || 20);
    if (!name || !code || !barcode || priceTl == null || priceTl < 0) {
      setMsg("Ad, kod, barkod ve fiyat zorunludur.");
      return;
    }
    if (!Number.isFinite(vatRatePercent) || vatRatePercent < 0 || vatRatePercent > 100) {
      setMsg("KDV orani 0-100 arasinda olmalidir.");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      await getMarinaApi().updateProduct(product.id, {
        name,
        description: draftDescription.trim(),
        code,
        barcode,
        priceKurus: categorySaleUnit === "gram" ? tlPer1000gToKurusPerGram(priceTl) : tlToKurus(priceTl),
        vatRatePercent,
        priceIncludesVat: draftPriceIncludesVat,
        domesticMade: draftDomesticMade
      });
      await onSaved?.();
      setEditMode(false);
      setMsg("Guncellendi.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Kayit basarisiz.");
    } finally {
      setSaving(false);
    }
  };

  const modal = (
    <div className="barcode-print-overlay" role="dialog" aria-modal="true" aria-labelledby="barcode-print-title" onClick={onClose}>
      <div className="barcode-print-dialog barcode-print-dialog--wide" onClick={(e) => e.stopPropagation()}>
        <div className="barcode-print-body">
          <header className="barcode-print-head">
            <p className="barcode-print-company">{company}</p>
            <h3 id="barcode-print-title" className="barcode-print-title">
              {product.name}
            </h3>
            <dl className="barcode-print-fields">
              <div className="barcode-print-field">
                <dt>Kod</dt>
                <dd>{editMode ? <input value={draftCode} onChange={(e) => setDraftCode(e.target.value)} /> : product.code || "—"}</dd>
              </div>
              <div className="barcode-print-field">
                <dt>Barkod</dt>
                <dd>
                  {editMode ? <input value={draftBarcode} onChange={(e) => setDraftBarcode(e.target.value)} /> : product.barcode || "—"}
                </dd>
              </div>
              <div className="barcode-print-field">
                <dt>Urun</dt>
                <dd>{editMode ? <input value={draftName} onChange={(e) => setDraftName(e.target.value)} /> : product.name}</dd>
              </div>
              <div className="barcode-print-field">
                <dt>Aciklama</dt>
                <dd>
                  {editMode ? (
                    <input
                      value={draftDescription}
                      onChange={(e) => setDraftDescription(e.target.value)}
                      placeholder="Etikette gorunecek aciklama"
                    />
                  ) : (
                    product.description?.trim() || "—"
                  )}
                </dd>
              </div>
              <div className="barcode-print-field">
                <dt>Koken</dt>
                <dd>
                  {editMode ? (
                    <label className="barcode-print-check">
                      <input type="checkbox" checked={draftDomesticMade} onChange={(e) => setDraftDomesticMade(e.target.checked)} />
                      Yerli uretim
                    </label>
                  ) : (
                    domestic
                  )}
                </dd>
              </div>
              <div className="barcode-print-field">
                <dt>Fiyat degisikligi</dt>
                <dd>{formatPriceDate(product.lastPriceChangeAt)}</dd>
              </div>
              <div className="barcode-print-field barcode-print-field-price">
                <dt>{categorySaleUnit === "gram" ? "Fiyat (1000 g)" : "Tutar"}</dt>
                <dd>
                  {editMode ? (
                    <>
                      <input
                        value={draftPriceTl}
                        onChange={(e) => setDraftPriceTl(e.target.value)}
                        inputMode="decimal"
                        placeholder={categorySaleUnit === "gram" ? "TL / 1000 g" : "TL"}
                      />
                      <input
                        value={draftVatPercent}
                        onChange={(e) => setDraftVatPercent(e.target.value)}
                        inputMode="decimal"
                        className="barcode-print-vat-input"
                      />
                      <label className="barcode-print-check">
                        <input
                          type="checkbox"
                          checked={draftPriceIncludesVat}
                          onChange={(e) => setDraftPriceIncludesVat(e.target.checked)}
                        />
                        KDV dahil
                      </label>
                    </>
                  ) : (
                    <>
                      <strong>
                        {categorySaleUnit === "gram" ? formatTlPer1000g(product.priceKurus) : formatTry(product.priceKurus)}
                      </strong>
                      <span className="barcode-print-vat-badge">{vatNote}</span>
                    </>
                  )}
                  {editMode ? <span className="barcode-print-vat-badge">{vatNoteDraft}</span> : null}
                </dd>
              </div>
            </dl>
          </header>

          <section className="barcode-label-size screen-only" aria-labelledby="barcode-label-size-title">
            <h4 id="barcode-label-size-title" className="barcode-label-fields-title">
              Etiket boyutu
            </h4>
            <div className="barcode-label-size-list" role="listbox" aria-label="Etiket boyutu">
              {BARCODE_LABEL_SIZES.map((size) => {
                const active = size.id === labelSizeId;
                return (
                  <button
                    key={size.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`barcode-label-size-option${active ? " is-active" : ""}`}
                    onClick={() => selectSize(size.id)}
                  >
                    <strong>{size.label}</strong>
                    <small>{formatLabelSizeMm(size)}</small>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="barcode-label-fields screen-only" aria-labelledby="barcode-label-fields-title">
            <h4 id="barcode-label-fields-title" className="barcode-label-fields-title">
              Etikette goster
            </h4>
            <p className="barcode-print-hint">Tik acik alanlar etikete yazilir. Bos aciklama gizlenir.</p>
            <div className="barcode-label-fields-grid">
              {BARCODE_LABEL_FIELD_META.map((meta) => (
                <div key={meta.id} className="barcode-label-field-block">
                  <label className="barcode-label-field-tick">
                    <input
                      type="checkbox"
                      checked={Boolean(labelFields[meta.id])}
                      onChange={() => toggleField(meta.id)}
                    />
                    <span>
                      <strong>{meta.label}</strong>
                      <small>{meta.hint}</small>
                    </span>
                  </label>
                  {meta.id === "productName" && labelFields.productName ? (
                    <label className="barcode-label-field-tick is-nested">
                      <input
                        type="checkbox"
                        checked={Boolean(labelFields.productNameBlack)}
                        onChange={() => toggleField(PRODUCT_NAME_BLACK_META.id)}
                      />
                      <span>
                        <strong>{PRODUCT_NAME_BLACK_META.label}</strong>
                        <small>{PRODUCT_NAME_BLACK_META.hint}</small>
                      </span>
                    </label>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <div className="barcode-label-preview-wrap screen-only" aria-label="Etiket onizleme">
            <p className="barcode-label-preview-caption">
              Onizleme · {formatLabelSizeMm(labelSize)}
            </p>
            <p className="barcode-label-print-hint">
              {labelSize.id === "100x100" ? (
                <>
                  <strong>100×100 mm</strong> fiziksel etiket rulonuz takili olmali. Xprinter surucusunde kâgit boyutu da{" "}
                  <strong>100×100 mm</strong> olarak tanimli olmali — 60×40 ayariyla 100×100 baski bos cikar. Olcek{" "}
                  <strong>%100</strong>.
                </>
              ) : (
                <>
                  Yazicida kâgit/etiket boyutu buradaki secimle ayni olmali ({formatLabelSizeMm(labelSize)}). Yazdir
                  penceresinde olcek <strong>%100</strong> — Doldur veya Sigdir kullanmayin.
                </>
              )}
            </p>
            <div
              className={`barcode-label-preview${layoutScale === "dense" ? " is-dense" : ""}${layoutScale === "air" ? " is-air" : ""} size-${labelSize.id}`}
              style={{
                maxWidth: labelSize.previewMaxPx,
                aspectRatio: `${labelSize.widthMm} / ${labelSize.heightMm}`,
                padding: labelSize.padding,
                gap: labelSize.gap
              }}
            >
              <div className="blp-top">
                {f.companyName ? (
                  <div className="blp-company" style={{ fontSize: companyFs }}>
                    {labelView.companyName}
                  </div>
                ) : null}
                {f.productName ? (
                  <div
                    className={`blp-name${f.productNameBlack ? " is-black" : ""}`}
                    style={{ fontSize: nameFs }}
                  >
                    {labelView.name}
                  </div>
                ) : null}
                {showDescription ? (
                  <div
                    className="blp-desc"
                    style={{ fontSize: labelSize.fonts.desc, marginBottom: labelSize.descGap }}
                  >
                    {labelView.description}
                  </div>
                ) : null}
              </div>
              <div className="blp-foot">
                <div className="blp-mid">
                  <div className="blp-left">
                    {f.domesticBadge && labelView.isDomestic ? (
                      <div className="blp-dom" aria-label="Yerli uretim">
                        <img
                          className="blp-dom-logo"
                          src={yerliLogoDataUrl}
                          alt="Yerli Uretim"
                          style={{ height: labelSize.domLogoHeight }}
                        />
                      </div>
                    ) : null}
                    {f.unitPriceLine ? (
                      <div className="blp-detail" style={{ fontSize: detailFs }}>
                        {unitPriceLineText(labelView.priceDigits, categorySaleUnit)}
                      </div>
                    ) : null}
                    {f.origin ? (
                      <div className="blp-detail" style={{ fontSize: detailFs }}>
                        {originLabel(labelView.isDomestic)}
                      </div>
                    ) : null}
                    {f.fdt && labelView.priceDate !== "—" ? (
                      <div className="blp-detail" style={{ fontSize: detailFs }}>
                        FDT : {labelView.priceDate}
                      </div>
                    ) : null}
                  </div>
                  <div className="blp-right">
                    {f.price || f.vatStack ? (
                      <div className="blp-price-block">
                        {f.price ? (
                          <div className="blp-price" style={{ fontSize: priceFs }}>
                            {labelView.priceDigits}
                          </div>
                        ) : null}
                        {f.vatStack ? (
                          <div className="blp-vat" style={{ fontSize: labelSize.fonts.vat }}>
                            {labelView.vatLines.map((line, idx) => (
                              <span key={`${idx}-${line}`}>{line}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {categorySaleUnit === "gram" && f.price ? (
                      <div className="blp-gram-hint" style={{ fontSize: labelSize.fonts.gram }}>
                        / 1000 g
                      </div>
                    ) : null}
                  </div>
                </div>
                {f.barcode ? (
                  <div className="blp-bc">
                    <svg ref={svgRef} />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="barcode-print-actions screen-only">
          {editMode ? (
            <button type="button" className="barcode-print-primary" onClick={() => void saveEdits()} disabled={saving}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          ) : (
            <button type="button" onClick={() => setEditMode(true)}>
              Duzenle
            </button>
          )}
          <button
            type="button"
            className="barcode-print-primary"
            disabled={printing}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handlePrint();
            }}
          >
            {printing ? "Yazdiriliyor..." : "Yazdir"}
          </button>
          {editMode ? (
            <button type="button" onClick={() => setEditMode(false)}>
              Duzenlemeyi Kapat
            </button>
          ) : null}
          <button type="button" onClick={onClose}>
            Kapat
          </button>
        </div>
        {msg ? <p className="barcode-print-msg screen-only">{msg}</p> : null}
      </div>
    </div>
  );

  /* Stok layout input { width:100% } gibi kurallar modalı bozmasın — body'ye portal */
  return createPortal(modal, document.body);
}
