import type { CustomerKind } from "../types/models";

export function customerKindLabel(kind: CustomerKind): string {
  if (kind === "retail_regular") return "Perakende musteri";
  return "Kafe";
}

export function customerKindShort(kind: CustomerKind): string {
  if (kind === "retail_regular") return "Perakende";
  return "Kafe";
}

export function customerAddKindLabel(kind: CustomerKind): string {
  if (kind === "retail_regular") return "Perakende musteri";
  return "Kafe";
}
