import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { getMarinaApi } from "../../api/marinaClient";
import type { CategorySaleUnit, Product, Settings } from "../../types/models";
import { formatTry, tlToKurus } from "../../utils/currency";
import { formatTlPer1000g, kurusPerGramToTlPer1000g, tlPer1000gToKurusPerGram } from "../../utils/saleUnit";

const DOMESTIC_BADGE_FILE =
  "C:/Users/ERDİN/.cursor/projects/c-Users-ERD-N-Desktop-Marina-Nargile/assets/c__Users_ERD_N_AppData_Roaming_Cursor_User_workspaceStorage_fe8bc153138162693e7c40a83ade354a_images_yerli_retim-f96bf6c7-7947-48b2-b912-89845ee77a61.png";

interface Props {
  product: Product | null;
  /** Gram urunlerde fiyat TL / 1000 g olarak gosterilir ve kaydedilir */
  categorySaleUnit?: CategorySaleUnit;
  settings: Settings | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
}

/** Barkodu SVG uzerinde uretir; EAN-13 gecerliyse o format, degilse CODE128 */
function renderBarcode(svg: SVGSVGElement, value: string) {
  const raw = value.trim();
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  if (!raw) {
    svg.innerHTML = '<text x="10" y="20" fill="#888">Barkod yok</text>';
    return;
  }
  const opts = {
    width: 2.25,
    height: 108,
    displayValue: true,
    fontSize: 14,
    textMargin: 4,
    margin: 16,
    background: "#ffffff",
    lineColor: "#000000"
  } as const;
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

function formatPriceDate(iso: string) {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function BarcodePrintModal({ product, categorySaleUnit = "piece", settings, open, onClose, onSaved }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftCode, setDraftCode] = useState("");
  const [draftBarcode, setDraftBarcode] = useState("");
  const [draftPriceTl, setDraftPriceTl] = useState("");
  const [draftVatPercent, setDraftVatPercent] = useState("20");
  const [draftPriceIncludesVat, setDraftPriceIncludesVat] = useState(false);
  const [draftDomesticMade, setDraftDomesticMade] = useState(false);

  useEffect(() => {
    if (!product) return;
    setEditMode(false);
    setSaving(false);
    setMsg("");
    setDraftName(product.name ?? "");
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
    if (!open || !product || !svgRef.current) return;
    renderBarcode(svgRef.current, editMode ? draftBarcode : product.barcode);
  }, [open, product, editMode, draftBarcode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !product) return null;

  const company = (settings?.companyName ?? "").trim() || "Firma";
  const vatNote = product.priceIncludesVat ? "KDV dahil" : `KDV %${product.vatRatePercent ?? 20} (+)`;
  const domestic = product.domesticMade ? "Yerli uretim" : "Ithal / diger";
  const showDomesticBadge = editMode ? draftDomesticMade : product.domesticMade;
  const domesticBadgeSrc = encodeURI(`file:///${DOMESTIC_BADGE_FILE.replace(/\\/g, "/")}`);
  const draftVat = Number(draftVatPercent || 20);
  const vatNoteDraft = draftPriceIncludesVat ? "KDV dahil" : `KDV %${Number.isFinite(draftVat) ? draftVat : 20} (+)`;
  const domesticDraft = draftDomesticMade ? "Yerli uretim" : "Ithal / diger";

  const handlePrint = () => window.print();
  const saveEdits = async () => {
    if (!product) return;
    const name = draftName.trim();
    const code = draftCode.trim();
    const barcode = draftBarcode.trim();
    const priceTl = Number(String(draftPriceTl).replace(",", "."));
    const vatRatePercent = Number(draftVatPercent || 20);
    if (!name || !code || !barcode || !Number.isFinite(priceTl) || priceTl <= 0) {
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

  return (
    <div className="barcode-print-overlay" role="dialog" aria-modal="true" aria-labelledby="barcode-print-title" onClick={onClose}>
      <div className="barcode-print-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="barcode-print-sheet">
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
              <dd>{editMode ? <input value={draftBarcode} onChange={(e) => setDraftBarcode(e.target.value)} /> : product.barcode || "—"}</dd>
            </div>
            <div className="barcode-print-field">
              <dt>Urun</dt>
              <dd>{editMode ? <input value={draftName} onChange={(e) => setDraftName(e.target.value)} /> : product.name}</dd>
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
          <div className="barcode-print-svg-wrap">
            <svg ref={svgRef} className="barcode-print-svg" />
          </div>
          {showDomesticBadge ? (
            <div className="barcode-print-domestic-badge">
              <img
                src={domesticBadgeSrc}
                alt="Yerli Uretim"
                onError={(e) => {
                  const img = e.currentTarget;
                  img.style.display = "none";
                }}
              />
            </div>
          ) : null}
          <p className="barcode-print-hint screen-only">
            Yazdir dediginizde Windows yazdirma penceresi acilir; yazici ve kagit boyutunu oradan secersiniz.
          </p>
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
          <button type="button" className="barcode-print-primary" onClick={handlePrint}>
            Yazdir
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
        {msg ? <p className="barcode-print-hint screen-only">{msg}</p> : null}
      </div>
    </div>
  );
}
