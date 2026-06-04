import { useMemo } from "react";
import type { PaymentType } from "../../types/models";
import { formatTry, parseTrAmount, tlToKurus } from "../../utils/currency";

type Props = {
  balanceOwedKurus: number;
  amountTl: string;
  onAmountTlChange: (value: string) => void;
  paymentType: PaymentType;
  onPaymentTypeChange: (type: PaymentType) => void;
  saving: boolean;
  note: string;
  onNoteChange: (value: string) => void;
  onPay: (amountKurus: number, note: string) => void;
  /** Musteri tahsilati veya tedarikci odemesi */
  mode: "collect" | "pay";
};

export function DebtPaymentPanel({
  balanceOwedKurus,
  amountTl,
  onAmountTlChange,
  paymentType,
  onPaymentTypeChange,
  saving,
  note,
  onNoteChange,
  onPay,
  mode
}: Props) {
  const preview = useMemo(() => {
    const balance = Math.max(0, Math.round(balanceOwedKurus));
    if (balance <= 0) return { error: "Acik borc yok." as const };
    const trimmed = String(amountTl ?? "").trim();
    if (!trimmed) {
      return { error: "Odenecek tutar girin." as const };
    }
    const parsed = parseTrAmount(trimmed);
    if (parsed == null || !Number.isFinite(parsed) || parsed <= 0) {
      return { error: "Gecerli bir tutar girin." as const };
    }
    const payKurus = tlToKurus(parsed);
    if (payKurus > balance) {
      return { error: "Odeme tutari acik borctan fazla." as const };
    }
    const remainingKurus = balance - payKurus;
    return { payKurus, remainingKurus, balance };
  }, [amountTl, balanceOwedKurus]);

  const amountLabel = mode === "collect" ? "Tahsil edilecek (TL)" : "Odenecek tutar (TL)";
  const typeLabel = mode === "collect" ? "Tahsilat tipi" : "Odeme tipi";

  const handlePay = () => {
    if (!("payKurus" in preview) || preview.payKurus == null) return;
    onPay(preview.payKurus, String(note ?? "").trim());
  };

  const notePreview = String(note ?? "").trim();

  return (
    <div className="customer-debt-pay-block">
      <div className="customer-debt-pay-row">
        <label className="customer-debt-pay-amount-field">
          <span className="customer-debt-paid-label">{amountLabel}</span>
          <input
            type="text"
            inputMode="decimal"
            value={amountTl}
            onChange={(e) => onAmountTlChange(e.target.value)}
            disabled={saving}
            autoComplete="off"
            placeholder={formatTry(balanceOwedKurus)}
          />
        </label>
        <div className="customer-debt-pay-type-wrap">
          <span className="customer-debt-paid-label">{typeLabel}</span>
          <div className="customer-debt-pay-type" role="group" aria-label={typeLabel}>
            <button
              type="button"
              className={paymentType === "cash" ? "active" : ""}
              disabled={saving}
              onClick={() => onPaymentTypeChange("cash")}
            >
              Nakit
            </button>
            <button
              type="button"
              className={paymentType === "card" ? "active" : ""}
              disabled={saving}
              onClick={() => onPaymentTypeChange("card")}
            >
              Kart
            </button>
          </div>
        </div>
        <button
          type="button"
          className="cart-debt-panel-paid-btn customer-debt-paid-btn customer-debt-paid-btn--inline"
          disabled={saving || !("payKurus" in preview)}
          onClick={handlePay}
        >
          {saving ? "Kaydediliyor..." : "Borc odendi"}
        </button>
      </div>
      <label className="customer-debt-pay-note-field">
        <span className="customer-debt-paid-label">Not (opsiyonel)</span>
        <input
          type="text"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          disabled={saving}
          autoComplete="off"
          placeholder="Ornek: Fatura no, aciklama"
          maxLength={200}
        />
      </label>
      {notePreview ? (
        <p className="customer-debt-pay-hint">
          Kayitta gorunecek not: <strong>{notePreview}</strong>
        </p>
      ) : null}
      {"error" in preview && preview.error ? (
        <p className="customer-debt-pay-hint customer-debt-pay-hint--warn">{preview.error}</p>
      ) : null}
      {"remainingKurus" in preview && preview.remainingKurus != null ? (
        <p className="customer-debt-pay-hint">
          {preview.remainingKurus > 0 ? (
            <>
              Kalan borc: <strong>{formatTry(preview.remainingKurus)}</strong>
              {" · "}
              Bu islemde {mode === "collect" ? "tahsil" : "odenen"}: <strong>{formatTry(preview.payKurus!)}</strong>
            </>
          ) : (
            <>Tum borc kapanacak ({formatTry(preview.payKurus!)})</>
          )}
        </p>
      ) : null}
    </div>
  );
}
