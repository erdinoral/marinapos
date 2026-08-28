import type { PaymentType, SaleRecord } from "../types/models";
import { saleCollectedKurus } from "./saleCollected";

export function salePaymentLabel(paymentType: PaymentType | undefined): string {
  if (paymentType === "card") return "Kart";
  if (paymentType === "mixed") return "Karma";
  return "Nakit";
}

/** Gunluk kasa: nakit / kart kovalarina dagitilmis tahsilat */
export function saleCashCardCollectedKurus(
  sale: Pick<
    SaleRecord,
    | "kind"
    | "paymentType"
    | "subtotalKurus"
    | "paidAmountKurus"
    | "changeAmountKurus"
    | "debtAddedKurus"
    | "debtPaidKurus"
    | "extraFeeKurus"
    | "cashAmountKurus"
    | "cardAmountKurus"
  >
): { cashKurus: number; cardKurus: number } {
  const total = saleCollectedKurus(sale);
  if (sale.paymentType === "mixed") {
    const cashRaw = Math.max(0, Math.round(sale.cashAmountKurus ?? 0));
    const cardRaw = Math.max(0, Math.round(sale.cardAmountKurus ?? 0));
    const change = Math.max(0, Math.round(sale.changeAmountKurus ?? 0));
    const cashNet = Math.max(0, cashRaw - change);
    const cardNet = Math.max(0, cardRaw);
    const sum = cashNet + cardNet;
    if (sum <= 0) return { cashKurus: 0, cardKurus: 0 };
    if (sum === total) return { cashKurus: cashNet, cardKurus: cardNet };
    // Borc / yuvarlama farkinda orantila
    const cashShare = Math.round((total * cashNet) / sum);
    return { cashKurus: cashShare, cardKurus: Math.max(0, total - cashShare) };
  }
  if (sale.paymentType === "card") return { cashKurus: 0, cardKurus: total };
  return { cashKurus: total, cardKurus: 0 };
}
