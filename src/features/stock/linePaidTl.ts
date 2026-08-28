import { parseTrAmount, tlToKurus } from "../../utils/currency";

export type LinePaymentKurus = {
  amountPaidKurus: number;
  remainingDebtKurus: number;
};

/** Bos = tam odendi. Odenen tutar alis tutarini gecemez. */
export function resolveLinePaymentFromPaidTl(
  linePaidTl: string,
  lineCostKurus: number,
  options?: { alert?: (msg: string) => void }
): LinePaymentKurus | null {
  const alert = options?.alert ?? ((msg: string) => window.alert(msg));
  const trimmed = String(linePaidTl ?? "").trim();
  const cost = Math.max(0, Math.round(lineCostKurus));
  if (!trimmed) {
    return { amountPaidKurus: cost, remainingDebtKurus: 0 };
  }
  const paid = parseTrAmount(trimmed);
  if (paid == null || paid < 0) {
    alert("Odenen tutar (TL) gecersiz.");
    return null;
  }
  const amountPaidKurus = tlToKurus(paid);
  if (amountPaidKurus > cost) {
    alert("Odenen tutar, alis tutarindan fazla olamaz.");
    return null;
  }
  return { amountPaidKurus, remainingDebtKurus: cost - amountPaidKurus };
}
