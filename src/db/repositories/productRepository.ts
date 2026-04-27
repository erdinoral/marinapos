import { Category, Product, ProductInput, StockEntryLogRow } from "../../types/models";
import { JsonStore } from "../store";

export class ProductRepository {
  constructor(private store: JsonStore) {}

  list(): Product[] {
    return this.store
      .getState()
      .products.filter((x) => x.isActive === 1)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  listCategories() {
    return this.store
      .getState()
      .categories.slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  createCategory(name: string): Category {
    const normalized = name.trim();
    if (!normalized) throw new Error("Kategori adi bos olamaz.");
    const state = this.store.getState();
    const existing = state.categories.find((x) => x.name.toLowerCase() === normalized.toLowerCase());
    if (existing) {
      return { ...existing };
    }
    state.sequences.categoryId += 1;
    const created: Category = { id: state.sequences.categoryId, name: normalized };
    state.categories.push(created);
    this.store.save();
    return created;
  }

  create(payload: ProductInput) {
    const state = this.store.getState();
    state.sequences.productId += 1;
    state.products.push({
      id: state.sequences.productId,
      ...payload,
      isActive: 1
    });
    this.store.save();
  }

  addStock(productId: number, quantity: number) {
    const state = this.store.getState();
    const product = state.products.find((p) => p.id === productId);
    if (!product) return;
    product.stockQty += quantity;
    state.sequences.stockMovementId += 1;
    state.stockMovements.push({
      id: state.sequences.stockMovementId,
      productId,
      type: "in",
      qty: quantity,
      note: "Stok ekleme",
      createdAt: new Date().toISOString()
    });
    this.store.save();
  }

  adjustStock(productId: number, countedQty: number, note = "") {
    const state = this.store.getState();
    const product = state.products.find((p) => p.id === productId);
    if (!product) return;
    if (!Number.isFinite(countedQty) || countedQty < 0) {
      throw new Error("Sayim adedi gecersiz.");
    }
    const previousQty = product.stockQty;
    const diff = countedQty - previousQty;
    if (diff === 0) return;
    product.stockQty = countedQty;
    state.sequences.stockMovementId += 1;
    const sign = diff > 0 ? "+" : "-";
    const normalizedNote = note.trim();
    const movementNote = normalizedNote
      ? `Sayim duzeltme (${sign}${Math.abs(diff)}): ${normalizedNote}`
      : `Sayim duzeltme (${sign}${Math.abs(diff)})`;
    state.stockMovements.push({
      id: state.sequences.stockMovementId,
      productId,
      type: "adjust",
      qty: Math.abs(diff),
      note: movementNote,
      createdAt: new Date().toISOString()
    });
    this.store.save();
  }

  lowStock(): Product[] {
    const state = this.store.getState();
    return state.products
      .filter((x) => x.isActive === 1 && x.stockQty < state.settings.lowStockThreshold)
      .sort((a, b) => a.stockQty - b.stockQty);
  }

  listStockEntryLog(limit = 250): StockEntryLogRow[] {
    const state = this.store.getState();
    const nameById = new Map(state.products.map((p) => [p.id, p]));
    return state.stockMovements
      .filter((m) => m.type === "in")
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((m) => {
        const product = nameById.get(m.productId);
        return {
          movementId: m.id,
          createdAt: m.createdAt,
          productId: m.productId,
          productName: product?.name ?? "(silinmis urun)",
          productCode: product?.code ?? "",
          qty: m.qty,
          note: m.note
        };
      });
  }
}
