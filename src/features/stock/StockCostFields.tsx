import { useEffect, useMemo, useState } from "react";
import type { CategorySaleUnit, Product, StockCostMode } from "../../types/models";
import { formatTry, formatTlTable, parseTrAmount, tlToKurus } from "../../utils/currency";
import { computeStockAddCosts, lineCostKurusFromUnit } from "../../utils/stockCost";
import { incomingCostTlToUnitCostKurus } from "../../utils/saleUnit";
import { resolveLinePaymentFromPaidTl } from "./linePaidTl";
import {
  centsToUsd,
  costUsdArrivalPreview,
  getCachedUsdTry,
  parseUsdAmount,
  parseUsdTryRate,
  usdCentsToTlKurus,
  usdToCents
} from "../../utils/usdPricing";

type Props = {
  saleUnit: CategorySaleUnit;
  qty: number;
  costMode: StockCostMode;
  onCostModeChange: (mode: StockCostMode) => void;
  incomingCostTl: string;
  onIncomingCostTlChange: (v: string) => void;
  invoicePaidTl: string;
  onInvoicePaidTlChange: (v: string) => void;
  linePaidTl: string;
  onLinePaidTlChange: (v: string) => void;
  disabled?: boolean;
  product?: Product | null;
  /** Toplu fatura modalinda onizleme blogu yer kaplar; false ile gizlenir */
  showCostPreview?: boolean;
  /** Toplu faturada kalem odeneni fatura altindaki odenen tutardan hesaplanir */
  hideLinePaid?: boolean;
};

export function StockCostFields({
  saleUnit,
  qty,
  costMode,
  onCostModeChange,
  incomingCostTl,
  onIncomingCostTlChange,
  invoicePaidTl,
  onInvoicePaidTlChange,
  linePaidTl,
  onLinePaidTlChange,
  disabled,
  product,
  showCostPreview = true,
  hideLinePaid = false
}: Props) {
  const incomingCostTitle =
    saleUnit === "gram" ? "Birim gelis (TL / 1000 g) *" : "Birim gelis (TL / adet) *";
  const incomingCostRefTitle =
    saleUnit === "gram" ? "Referans birim gelis (TL / 1000 g)" : "Referans birim gelis (TL / adet)";
  const usdCost = product?.pricedInUsd === true;
  const [costUsd, setCostUsd] = useState("");
  const [costUsdTryRate, setCostUsdTryRate] = useState("");

  useEffect(() => {
    if (!usdCost || !product) return;
    setCostUsd((product.costUsdCents ?? 0) > 0 ? centsToUsd(product.costUsdCents).toFixed(2) : "");
    const locked = Number(product.costUsdTryRate);
    const live = getCachedUsdTry();
    setCostUsdTryRate(locked > 0 ? String(locked) : live != null ? live.toFixed(4) : "");
  }, [usdCost, product?.id, product?.costUsdCents, product?.costUsdTryRate]);

  useEffect(() => {
    if (!usdCost) return;
    const usd = parseUsdAmount(costUsd);
    const rate = parseUsdTryRate(costUsdTryRate);
    if (usd == null || rate == null) return;
    const next = (usdCentsToTlKurus(usdToCents(usd), rate) / 100).toFixed(2);
    if (next !== incomingCostTl) onIncomingCostTlChange(next);
    // incomingCostTl bilerek bagimlilikta yok — donguyu engeller
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usdCost, costUsd, costUsdTryRate]);

  const preview = useMemo(() => {
    const q = Math.max(0, Math.round(qty));
    if (q <= 0) return null;
    const parsedUnit = incomingCostTlToUnitCostKurus(incomingCostTl, saleUnit);
    const cardUnit = Math.max(0, Math.round(Number(product?.costPriceKurus ?? 0)));
    let unitCatalogKurus = cardUnit;
    if (parsedUnit != null && parsedUnit !== undefined) unitCatalogKurus = parsedUnit;
    if (costMode === "product" && (parsedUnit === undefined || parsedUnit === null) && cardUnit <= 0) {
      return { error: "Birim gelis girin veya urun kartinda maliyet tanimlayin." };
    }
    try {
      const invoicePaidKurus =
        costMode === "invoice"
          ? (() => {
              const n = parseTrAmount(invoicePaidTl);
              return n != null && n > 0 ? tlToKurus(n) : 0;
            })()
          : undefined;
      if (costMode === "invoice" && (!invoicePaidKurus || invoicePaidKurus <= 0)) {
        return { catalogLineCostKurus: lineCostKurusFromUnit(unitCatalogKurus, q, saleUnit) };
      }
      const costs = computeStockAddCosts({
        costMode,
        qty: q,
        saleUnit,
        unitCatalogKurus,
        invoicePaidKurus
      });
      const payment = resolveLinePaymentFromPaidTl(linePaidTl, costs.lineCostKurus, { alert: () => {} });
      if (!payment) {
        const paidParsed = parseTrAmount(linePaidTl);
        if (linePaidTl.trim() && (paidParsed == null || paidParsed < 0)) {
          return { error: "Odenen tutar (TL) gecersiz." };
        }
        if (paidParsed != null && paidParsed > 0 && tlToKurus(paidParsed) > costs.lineCostKurus) {
          return { error: "Odenen tutar, alis tutarindan fazla olamaz." };
        }
      }
      const amountPaidKurus = payment?.amountPaidKurus ?? costs.lineCostKurus;
      const remainingDebtKurus = payment?.remainingDebtKurus ?? 0;
      return { costs, remainingDebtKurus, amountPaidKurus };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Hesaplanamadi." };
    }
  }, [saleUnit, qty, costMode, incomingCostTl, invoicePaidTl, linePaidTl, product?.costPriceKurus]);

  return (
    <div className="stock-cost-block">
      <div className="stock-cost-mode" role="group" aria-label="Maliyet hesaplama">
        <button
          type="button"
          className={costMode === "product" ? "active" : ""}
          disabled={disabled}
          onClick={() => onCostModeChange("product")}
        >
          Urun bazli
        </button>
        <button
          type="button"
          className={costMode === "invoice" ? "active" : ""}
          disabled={disabled}
          onClick={() => onCostModeChange("invoice")}
        >
          Odenen fatura
        </button>
      </div>

      {costMode === "product" && usdCost ? (
        <>
          <label className="stock-incoming-cost-label">
            <span className="stock-incoming-cost-title">Gelis kuru (USD/TRY) — hangi kurdan geldi *</span>
            <input
              type="text"
              inputMode="decimal"
              value={costUsdTryRate}
              onChange={(e) => setCostUsdTryRate(e.target.value)}
              disabled={disabled}
              autoComplete="off"
              placeholder="orn. 38.50"
            />
            <span className="stock-help small">
              Urun kartindaki gelis kuru varsayilan gelir; bu girise ozel degistirebilirsiniz.
              <button
                type="button"
                className="linkish"
                disabled={disabled || getCachedUsdTry() == null}
                onClick={() => {
                  const r = getCachedUsdTry();
                  if (r != null) setCostUsdTryRate(r.toFixed(4));
                }}
              >
                Guncel kuru yaz
              </button>
            </span>
          </label>
          <label className="stock-incoming-cost-label">
            <span className="stock-incoming-cost-title">
              {saleUnit === "gram" ? "Birim gelis (USD / 1000 g) *" : "Birim gelis (USD / adet) *"}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={costUsd}
              onChange={(e) => setCostUsd(e.target.value)}
              disabled={disabled}
              autoComplete="off"
            />
            <span className="stock-help small">
              {costUsdArrivalPreview(parseUsdAmount(costUsd) ?? 0, parseUsdTryRate(costUsdTryRate))}
              {" · "}
              TL birim: <strong>{incomingCostTl || "—"}</strong>
            </span>
          </label>
        </>
      ) : null}

      {costMode === "product" && !usdCost ? (
        <label className="stock-incoming-cost-label">
          <span className="stock-incoming-cost-title">{incomingCostTitle}</span>
          <input
            type="text"
            inputMode="decimal"
            value={incomingCostTl}
            onChange={(e) => onIncomingCostTlChange(e.target.value)}
            disabled={disabled}
            autoComplete="off"
          />
          <span className="stock-help small">
            {hideLinePaid
              ? "Satir tutari = birim × miktar. Eksik odeme varsa fatura altindaki odenen tutardan hesaplanir."
              : "Satir tutari = birim × miktar. Eksik odeme varsa asagida odenen tutari girin."}
          </span>
        </label>
      ) : null}

      {costMode === "invoice" ? (
        <label className="stock-incoming-cost-label">
          <span className="stock-incoming-cost-title">Odenen fatura tutari (TL) *</span>
          <input
            type="text"
            inputMode="decimal"
            value={invoicePaidTl}
            onChange={(e) => onInvoicePaidTlChange(e.target.value)}
            disabled={disabled}
            autoComplete="off"
            placeholder="Ornek: 500"
          />
          <span className="stock-help small">
            Liste / birim fiyata gore beklenen tutardan farkli odeme (anlasma, iskonto). Birim maliyet buna gore
            hesaplanir.
          </span>
        </label>
      ) : null}

      {costMode === "invoice" ? (
        <label className="stock-incoming-cost-label">
          <span className="stock-incoming-cost-title">{incomingCostRefTitle}</span>
          <input
            type="text"
            inputMode="decimal"
            value={incomingCostTl}
            onChange={(e) => onIncomingCostTlChange(e.target.value)}
            disabled={disabled}
            autoComplete="off"
          />
          <span className="stock-help small">Karsilastirma icin; bos birakilirsa urun kartindaki maliyet kullanilir.</span>
        </label>
      ) : null}

      {hideLinePaid ? null : (
        <label className="stock-incoming-cost-label">
          <span className="stock-incoming-cost-title">Odenen tutar (TL)</span>
          <input
            type="text"
            inputMode="decimal"
            value={linePaidTl}
            onChange={(e) => onLinePaidTlChange(e.target.value)}
            disabled={disabled}
            autoComplete="off"
            placeholder="Bos = tam odendi"
          />
          <span className="stock-help small">
            Bu kaleme odediginiz tutar. Fark (alis − odenen) secili tedarikcinin borcuna yazilir; gidere yalnizca
            odenen tutar duser.
          </span>
        </label>
      )}

      {preview && "error" in preview ? <p className="stock-cost-preview stock-cost-preview-warn">{preview.error}</p> : null}
      {!showCostPreview &&
      preview &&
      "costs" in preview &&
      preview.costs &&
      "remainingDebtKurus" in preview &&
      preview.remainingDebtKurus != null &&
      preview.remainingDebtKurus > 0 ? (
        <p className="stock-cost-preview stock-cost-preview-row--debt small">
          Bu kalem borcu: <strong>{formatTry(preview.remainingDebtKurus)}</strong>
        </p>
      ) : null}
      {showCostPreview && preview && "costs" in preview && preview.costs ? (
        <div className="stock-cost-preview">
          <div className="stock-cost-preview-row">
            <span>Liste / birim hesabi</span>
            <strong>{formatTry(preview.costs.catalogLineCostKurus)}</strong>
          </div>
          <div className="stock-cost-preview-row">
            <span>Alis / borc tutari</span>
            <strong>{formatTry(preview.costs.lineCostKurus)}</strong>
          </div>
          <div className="stock-cost-preview-row stock-cost-preview-row--accent">
            <span>Gidere yazilacak (odenen)</span>
            <strong>
              {formatTry(
                ("amountPaidKurus" in preview ? preview.amountPaidKurus : undefined) ?? preview.costs.lineCostKurus
              )}
            </strong>
          </div>
          {"remainingDebtKurus" in preview && preview.remainingDebtKurus != null && preview.remainingDebtKurus > 0 ? (
            <div className="stock-cost-preview-row stock-cost-preview-row--debt">
              <span>Tedarikci borcu (bu giris)</span>
              <strong>{formatTry(preview.remainingDebtKurus)}</strong>
            </div>
          ) : null}
          <div className="stock-cost-preview-row">
            <span>Kayit birim maliyet</span>
            <strong>
              {saleUnit === "gram"
                ? `${formatTlTable(preview.costs.unitCostRecorded / 100).replace(" ₺", "")} / 1000 g`
                : `${formatTry(preview.costs.unitCostRecorded)} / adet`}
            </strong>
          </div>
          {costMode === "invoice" && preview.costs.catalogLineCostKurus !== preview.costs.lineCostKurus ? (
            <p className="stock-help small">
              Fark: {formatTry(preview.costs.catalogLineCostKurus - preview.costs.lineCostKurus)} (liste uzerinden
              indirim)
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
