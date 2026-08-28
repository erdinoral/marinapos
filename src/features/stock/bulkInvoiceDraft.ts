import type { ReceiveCartLine } from "./receiveStockTypes";

const STORAGE_KEY = "marina-bulk-invoice-draft";

export type BulkInvoiceDraft = {
  supplierId: number;
  cart: ReceiveCartLine[];
  invoicePaidTl: string;
  pickerProductId: number | null;
  productSearch: string;
};

export function loadBulkInvoiceDraft(): BulkInvoiceDraft | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BulkInvoiceDraft;
    if (!parsed || !Array.isArray(parsed.cart) || parsed.cart.length === 0) return null;
    return {
      supplierId: Number(parsed.supplierId) || 0,
      cart: parsed.cart.map((line) => ({
        ...line,
        linePaidTl: String((line as ReceiveCartLine & { remainingDebtTl?: string }).linePaidTl ?? "")
      })),
      invoicePaidTl: String(parsed.invoicePaidTl ?? ""),
      pickerProductId: parsed.pickerProductId != null ? Number(parsed.pickerProductId) : null,
      productSearch: String(parsed.productSearch ?? "")
    };
  } catch {
    return null;
  }
}

export function saveBulkInvoiceDraft(draft: BulkInvoiceDraft): void {
  if (typeof sessionStorage === "undefined") return;
  if (draft.cart.length === 0) {
    clearBulkInvoiceDraft();
    return;
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* quota / private mode */
  }
}

export function clearBulkInvoiceDraft(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function bulkInvoiceDraftSummary(): { lineCount: number; supplierId: number } | null {
  const draft = loadBulkInvoiceDraft();
  if (!draft) return null;
  return { lineCount: draft.cart.length, supplierId: draft.supplierId };
}
