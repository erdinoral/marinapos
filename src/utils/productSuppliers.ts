import type { Product } from "../types/models";

/** Ek tedarikci listesini birincil haric, tekrarsiz ve gecerli id olarak normalize eder. */
export function normalizeAlternateSupplierIds(
  alternateIds: number[] | undefined,
  primarySupplierId: number
): number[] {
  const primary = Math.max(0, Math.floor(Number(primarySupplierId) || 0));
  const seen = new Set<number>();
  const out: number[] = [];
  for (const raw of alternateIds ?? []) {
    const id = Math.max(0, Math.floor(Number(raw) || 0));
    if (id <= 0 || id === primary || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function productSupplierIds(product: Pick<Product, "supplierId" | "alternateSupplierIds">): number[] {
  const primary = Math.max(0, Math.floor(Number(product.supplierId) || 0));
  const alternates = normalizeAlternateSupplierIds(product.alternateSupplierIds, primary);
  return primary > 0 ? [primary, ...alternates] : alternates;
}

export function productHasSupplier(
  product: Pick<Product, "supplierId" | "alternateSupplierIds">,
  supplierId: number
): boolean {
  const sid = Math.max(0, Math.floor(Number(supplierId) || 0));
  if (sid <= 0) return false;
  return productSupplierIds(product).includes(sid);
}

export function productSupplierLabel(
  product: Pick<Product, "supplierId" | "alternateSupplierIds">,
  supplierNameById: Map<number, string>
): string {
  const ids = productSupplierIds(product);
  if (ids.length === 0) return "-";
  const names = ids.map((id) => supplierNameById.get(id)).filter(Boolean) as string[];
  if (names.length === 0) return "-";
  if (names.length === 1) return names[0];
  return `${names[0]} (+${names.length - 1})`;
}
