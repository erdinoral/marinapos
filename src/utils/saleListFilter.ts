import type { Category, CategorySaleUnit, Product } from "../types/models";

export type SaleCatalogUnitFilter = "all" | CategorySaleUnit;

export function saleMatchesCatalogFilter(
  saleId: number,
  productIdsBySale: Record<number, number[]>,
  products: Product[],
  categories: Category[],
  unitFilter: SaleCatalogUnitFilter,
  categoryId: number
): boolean {
  if (unitFilter === "all" && categoryId === 0) return true;
  const lineProductIds = productIdsBySale[saleId] ?? [];
  if (lineProductIds.length === 0) return true;
  return lineProductIds.some((pid) => {
    const p = products.find((x) => x.id === pid);
    if (!p) return false;
    const cat = categories.find((c) => c.id === p.categoryId);
    const unit: CategorySaleUnit = cat?.saleUnit === "gram" ? "gram" : "piece";
    if (unitFilter !== "all" && unit !== unitFilter) return false;
    if (categoryId !== 0 && p.categoryId !== categoryId) return false;
    return true;
  });
}
