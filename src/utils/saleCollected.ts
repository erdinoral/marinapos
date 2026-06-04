import type { SaleKind, SaleRecord } from "../types/models";

/** Kasaya giren net tahsilat (kurus): borc eklenen satista yalnizca odenen kisim; borc tahsilati ayri kayit. */
export function saleCollectedKurus(sale: Pick<
  SaleRecord,
  "kind" | "paymentType" | "subtotalKurus" | "paidAmountKurus" | "changeAmountKurus" | "debtAddedKurus" | "debtPaidKurus" | "extraFeeKurus"
>): number {
  const kind = (sale.kind ?? "sale") as SaleKind;
  if (kind === "return") return sale.subtotalKurus;
  if (kind === "debt_payment") {
    return Math.max(0, sale.debtPaidKurus ?? sale.paidAmountKurus ?? 0);
  }

  const paid = Math.max(0, Math.round(sale.paidAmountKurus ?? 0));
  const change = Math.max(0, Math.round(sale.changeAmountKurus ?? 0));
  const debtPaid = Math.max(0, Math.round(sale.debtPaidKurus ?? 0));
  const debtAdded = Math.max(0, Math.round(sale.debtAddedKurus ?? 0));
  const extra = Math.max(0, Math.round(sale.extraFeeKurus ?? 0));
  const subtotal = Math.round(sale.subtotalKurus ?? 0);

  if (debtAdded > 0) return paid;

  if (sale.paymentType === "card") {
    return Math.max(0, subtotal + extra + debtPaid);
  }

  return Math.max(0, paid - change);
}

export function saleKindListLabel(kind: SaleKind | undefined): string {
  if (kind === "return") return "Iade";
  if (kind === "debt_payment") return "Borc odemesi";
  return "Satis";
}
