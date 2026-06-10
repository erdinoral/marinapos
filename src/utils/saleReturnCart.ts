import type { Product, SaleWithLines } from "../types/models";
import type { PosCartLine } from "../features/pos/posCartLine";

export async function buildReturnCartLinesFromSale(
  detail: SaleWithLines,
  products: Product[],
  getProductById?: (id: number) => Promise<Product | null>
): Promise<{ lines: PosCartLine[]; missing: string[] }> {
  const lines: PosCartLine[] = [];
  const missing: string[] = [];
  for (const ln of detail.items) {
    if (ln.productId < 0 || (ln.productName ?? "").includes("Kart (Ozel)")) continue;
    let p: Product | null = products.find((x) => x.id === ln.productId) ?? null;
    if (!p && getProductById) {
      p = await getProductById(ln.productId);
    }
    if (!p) {
      missing.push(`${ln.productName} (ID ${ln.productId})`);
      continue;
    }
    const qty = Math.abs(Number(ln.qty));
    const unit = Math.max(0, Math.round(Number(ln.unitPriceKurus)));
    lines.push({
      ...p,
      qty,
      priceSource: "retail",
      manualUnitPriceKurus: unit,
      manualUnitCostKurus: null,
      lineExtraDiscountPercent: 0,
      manualLineTotalTlWhole: null
    });
  }
  return { lines, missing };
}
