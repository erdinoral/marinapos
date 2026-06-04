import { useMemo } from "react";
import type { CategorySaleUnit, Product, StockCostMode } from "../../types/models";
import { formatTry, parseTrAmount, tlToKurus } from "../../utils/currency";
import { computeStockAddCosts, lineCostKurusFromUnit } from "../../utils/stockCost";
import { incomingCostTlToUnitCostKurus } from "../../utils/saleUnit";

type Props = {
  saleUnit: CategorySaleUnit;
  qty: number;
  costMode: StockCostMode;
  onCostModeChange: (mode: StockCostMode) => void;
  incomingCostTl: string;
  onIncomingCostTlChange: (v: string) => void;
  invoicePaidTl: string;
  onInvoicePaidTlChange: (v: string) => void;
  remainingDebtTl: string;
  onRemainingDebtTlChange: (v: string) => void;
  disabled?: boolean;
  product?: Product | null;
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
  remainingDebtTl,
  onRemainingDebtTlChange,
  disabled,
  product
}: Props) {
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
      const debtParsed = parseTrAmount(remainingDebtTl);
      const remainingDebtKurus =
        debtParsed != null && debtParsed > 0 ? tlToKurus(debtParsed) : 0;
      if (remainingDebtKurus > costs.lineCostKurus) {
        return { error: "Kalan borc, alis tutarindan fazla olamaz." };
      }
      const amountPaidKurus = costs.lineCostKurus - remainingDebtKurus;
      return { costs, remainingDebtKurus, amountPaidKurus };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Hesaplanamadi." };
    }
  }, [saleUnit, qty, costMode, incomingCostTl, invoicePaidTl, remainingDebtTl, product?.costPriceKurus]);

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

      {costMode === "product" ? (
        <label className="stock-incoming-cost-label">
          <span className="stock-incoming-cost-title">Birim gelis (TL) *</span>
          <input
            type="text"
            inputMode="decimal"
            value={incomingCostTl}
            onChange={(e) => onIncomingCostTlChange(e.target.value)}
            disabled={disabled}
            autoComplete="off"
          />
          <span className="stock-help small">Satir tutari = birim × miktar. Eksik odeme varsa asagida kalan borc girin.</span>
        </label>
      ) : (
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
      )}

      {costMode === "invoice" ? (
        <label className="stock-incoming-cost-label">
          <span className="stock-incoming-cost-title">Referans birim gelis (TL)</span>
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

      <label className="stock-incoming-cost-label">
        <span className="stock-incoming-cost-title">Kalan borc (TL)</span>
        <input
          type="text"
          inputMode="decimal"
          value={remainingDebtTl}
          onChange={(e) => onRemainingDebtTlChange(e.target.value)}
          disabled={disabled}
          autoComplete="off"
          placeholder="Bos = tam odendi"
        />
        <span className="stock-help small">
          Alis tutarinin odenmeyen kismi; secili tedarikcinin borcuna eklenir. Gidere yalnizca odenen tutar yazilir.
        </span>
      </label>

      {preview && "error" in preview ? <p className="stock-cost-preview stock-cost-preview-warn">{preview.error}</p> : null}
      {preview && "costs" in preview && preview.costs ? (
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
                ? `${(preview.costs.unitCostRecorded / 100).toFixed(2)} TL / 1000 g`
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
