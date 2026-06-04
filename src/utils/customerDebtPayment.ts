/** Sepet tutarinin uzerindeki tahsilat (kurus) */
export function salePaymentSurplusKurus(paidKurus: number, subtotalKurus: number): number {
  return Math.max(0, Math.round(paidKurus) - Math.round(subtotalKurus));
}

/** Fazla odemeden mevcut borca uygulanacak tutar */
export function debtReductionFromSurplusKurus(surplusKurus: number, currentDebtKurus: number): number {
  return Math.min(Math.max(0, Math.round(surplusKurus)), Math.max(0, Math.round(currentDebtKurus)));
}

export function customerBalanceAfterSaleKurus(
  currentDebtKurus: number,
  shortfallKurus: number,
  surplusKurus: number
): number {
  const reduction = debtReductionFromSurplusKurus(surplusKurus, currentDebtKurus);
  return Math.max(0, Math.round(currentDebtKurus) - reduction + Math.max(0, Math.round(shortfallKurus)));
}

/** Nakit para ustu: borca yazilmayan kisim */
export function cashChangeAfterDebtPaymentKurus(surplusKurus: number, currentDebtKurus: number): number {
  const reduction = debtReductionFromSurplusKurus(surplusKurus, currentDebtKurus);
  return Math.max(0, Math.round(surplusKurus) - reduction);
}
