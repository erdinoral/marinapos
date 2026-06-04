import type { Customer, CustomerKind } from "../types/models";

/** Secilen turdeki musterilerin acik borc toplami (kurus). */
export function totalDebtKurusByKind(customers: Customer[], kind: CustomerKind): number {
  let sum = 0;
  for (const c of customers) {
    if (c.kind === kind && c.balanceOwedKurus > 0) sum += c.balanceOwedKurus;
  }
  return sum;
}

export function hasDebtByKind(customers: Customer[], kind: CustomerKind): boolean {
  return customers.some((c) => c.kind === kind && c.balanceOwedKurus > 0);
}

export function customersWithDebtByKind(customers: Customer[], kind: CustomerKind): Customer[] {
  return customers
    .filter((c) => c.kind === kind && c.balanceOwedKurus > 0)
    .sort((a, b) => b.balanceOwedKurus - a.balanceOwedKurus || a.name.localeCompare(b.name, "tr"));
}
