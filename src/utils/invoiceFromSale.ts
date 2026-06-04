import type { InvoiceCustomerInfo, SaleLineInput, SaleRecord, SaleWithLines } from "../types/models";

export function canCreateInvoiceForSale(sale: SaleRecord): boolean {
  return sale.kind === "sale" || sale.kind === "return";
}

/** Satis satirlarini fatura onizleme / kayit girdisine cevir */
export function saleToInvoiceLineItems(sw: SaleWithLines): SaleLineInput[] {
  return sw.items
    .filter((ln) => ln.productId > 0 && !(ln.productName ?? "").includes("Kart (Ozel)"))
    .map((ln) => ({
      productId: ln.productId,
      qty: Math.abs(Number(ln.qty)),
      unitPriceKurus: Math.max(0, Math.round(Number(ln.unitPriceKurus)))
    }));
}

export function saleInvoiceExtraFeeKurus(sw: SaleWithLines): number {
  if (sw.sale.kind !== "sale") return 0;
  return Math.max(0, Math.round(Number(sw.sale.extraFeeKurus) || 0));
}

export function saleHasInvoiceLines(sw: SaleWithLines): boolean {
  return saleToInvoiceLineItems(sw).length > 0 || saleInvoiceExtraFeeKurus(sw) > 0;
}
