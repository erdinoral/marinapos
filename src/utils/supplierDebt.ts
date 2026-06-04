import type { Supplier } from "../types/models";

/** Tedarikcilere toplam acik borc (kurus). */
export function totalSupplierDebtKurus(suppliers: Supplier[]): number {
  let sum = 0;
  for (const s of suppliers) {
    if (s.balanceOwedKurus > 0) sum += s.balanceOwedKurus;
  }
  return sum;
}

export function hasSupplierDebt(suppliers: Supplier[]): boolean {
  return suppliers.some((s) => s.balanceOwedKurus > 0);
}

export function suppliersWithDebt(suppliers: Supplier[]): Supplier[] {
  return suppliers.filter((s) => s.balanceOwedKurus > 0).sort((a, b) => b.balanceOwedKurus - a.balanceOwedKurus);
}
