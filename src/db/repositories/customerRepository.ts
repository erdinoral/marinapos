import type {
  Customer,
  CustomerInput,
  CustomerKind,
  CustomerProductPrice,
  CustomerPurchaseRow
} from "../../types/models";
import { JsonStore } from "../store";
import { categorySaleUnitOf } from "../../utils/saleUnit";

function normalizeKind(k: unknown): CustomerKind {
  return k === "retail_regular" ? "retail_regular" : "wholesale";
}

export class CustomerRepository {
  constructor(private store: JsonStore) {}

  list(): Customer[] {
    return this.store
      .getState()
      .customers.slice()
      .sort((a, b) => a.name.localeCompare(b.name, "tr") || a.id - b.id);
  }

  getById(id: number): Customer | null {
    const c = this.store.getState().customers.find((x) => x.id === id);
    return c ? { ...c } : null;
  }

  create(input: CustomerInput): Customer {
    const state = this.store.getState();
    const name = String(input.name ?? "").trim();
    if (!name) throw new Error("Musteri adi gerekli.");
    const kind = normalizeKind(input.kind ?? "wholesale");
    state.sequences.customerId += 1;
    const customer: Customer = {
      id: state.sequences.customerId,
      kind,
      name,
      phone: String(input.phone ?? "").trim(),
      note: String(input.note ?? "").trim(),
      email: String(input.email ?? "").trim(),
      companyName: String(input.companyName ?? "").trim(),
      address: String(input.address ?? "").trim(),
      district: String(input.district ?? "").trim(),
      city: String(input.city ?? "").trim(),
      taxOrVkn: String(input.taxOrVkn ?? "").trim(),
      balanceOwedKurus: Math.max(0, Math.round(Number(input.balanceOwedKurus ?? 0))),
      suggestedDiscountPercent: Math.max(0, Math.min(100, Number(input.suggestedDiscountPercent ?? 0))),
      createdAt: new Date().toISOString()
    };
    state.customers.push(customer);
    this.store.save();
    return { ...customer };
  }

  update(id: number, patch: Partial<CustomerInput>): Customer | null {
    const state = this.store.getState();
    const idx = state.customers.findIndex((x) => x.id === id);
    if (idx < 0) return null;
    const cur = state.customers[idx];
    if (patch.name != null) {
      const n = String(patch.name).trim();
      if (!n) throw new Error("Musteri adi bos olamaz.");
      cur.name = n;
    }
    if (patch.kind != null) cur.kind = normalizeKind(patch.kind);
    if (patch.phone != null) cur.phone = String(patch.phone).trim();
    if (patch.note != null) cur.note = String(patch.note).trim();
    if (patch.email != null) cur.email = String(patch.email).trim();
    if (patch.companyName != null) cur.companyName = String(patch.companyName).trim();
    if (patch.address != null) cur.address = String(patch.address).trim();
    if (patch.district != null) cur.district = String(patch.district).trim();
    if (patch.city != null) cur.city = String(patch.city).trim();
    if (patch.taxOrVkn != null) cur.taxOrVkn = String(patch.taxOrVkn).trim();
    if (patch.balanceOwedKurus != null) cur.balanceOwedKurus = Math.max(0, Math.round(Number(patch.balanceOwedKurus)));
    if (patch.suggestedDiscountPercent != null) {
      cur.suggestedDiscountPercent = Math.max(0, Math.min(100, Number(patch.suggestedDiscountPercent)));
    }
    this.store.save();
    return { ...cur };
  }

  /** Musteriyi listeden siler; gecmis satislardaki customerId baglantisi kaldirilir. */
  addDebt(customerId: number, amountKurus: number): Customer | null {
    const state = this.store.getState();
    const c = state.customers.find((x) => x.id === customerId);
    if (!c) return null;
    const add = Math.max(0, Math.round(Number(amountKurus) || 0));
    if (add <= 0) return { ...c };
    c.balanceOwedKurus += add;
    this.store.save();
    return { ...c };
  }

  delete(id: number): void {
    const state = this.store.getState();
    const idx = state.customers.findIndex((x) => x.id === id);
    if (idx < 0) throw new Error("Musteri bulunamadi.");
    for (const s of state.sales) {
      if (s.customerId === id) delete s.customerId;
    }
    state.customerProductPrices = state.customerProductPrices.filter((p) => p.customerId !== id);
    state.customers.splice(idx, 1);
    this.store.save();
  }

  listProductPrices(customerId: number): CustomerProductPrice[] {
    const state = this.store.getState();
    if (!state.customers.some((c) => c.id === customerId)) return [];
    return state.customerProductPrices
      .filter((p) => p.customerId === customerId)
      .slice()
      .sort((a, b) => a.productId - b.productId);
  }

  setProductPrice(customerId: number, productId: number, priceKurus: number): void {
    const state = this.store.getState();
    if (!state.customers.some((c) => c.id === customerId)) throw new Error("Musteri bulunamadi.");
    if (!state.products.some((p) => p.id === productId)) throw new Error("Urun bulunamadi.");
    const kurus = Math.max(0, Math.round(Number(priceKurus) || 0));
    const idx = state.customerProductPrices.findIndex((p) => p.customerId === customerId && p.productId === productId);
    if (kurus <= 0) {
      if (idx >= 0) state.customerProductPrices.splice(idx, 1);
      this.store.save();
      return;
    }
    const row: CustomerProductPrice = {
      customerId,
      productId,
      priceKurus: kurus,
      updatedAt: new Date().toISOString()
    };
    if (idx >= 0) state.customerProductPrices[idx] = row;
    else state.customerProductPrices.push(row);
    this.store.save();
  }

  getPurchaseSummary(customerId: number): CustomerPurchaseRow[] {
    const state = this.store.getState();
    if (!state.customers.some((c) => c.id === customerId)) return [];
    const salesById = new Map(
      state.sales.filter((s) => s.customerId === customerId).map((s) => [s.id, s] as const)
    );
    const acc = new Map<
      number,
      {
        productId: number;
        productName: string;
        productCode: string;
        saleUnit: CustomerPurchaseRow["saleUnit"];
        totalQty: number;
        totalRevenueKurus: number;
        transactionCount: number;
        lastPurchaseAt: string | null;
      }
    >();
    for (const item of state.saleItems) {
      const sale = salesById.get(item.saleId);
      if (!sale) continue;
      const sign = sale.kind === "return" ? -1 : 1;
      const p = state.products.find((x) => x.id === item.productId);
      const saleUnit = categorySaleUnitOf(state.categories, p?.categoryId ?? 0);
      let row = acc.get(item.productId);
      if (!row) {
        row = {
          productId: item.productId,
          productName: p?.name ?? "(silinmis urun)",
          productCode: p?.code ?? "",
          saleUnit,
          totalQty: 0,
          totalRevenueKurus: 0,
          transactionCount: 0,
          lastPurchaseAt: null
        };
      }
      row.totalQty += item.qty * sign;
      row.totalRevenueKurus += item.lineTotalKurus * sign;
      if (sign > 0) {
        row.transactionCount += 1;
        if (!row.lastPurchaseAt || sale.createdAt > row.lastPurchaseAt) row.lastPurchaseAt = sale.createdAt;
      }
      acc.set(item.productId, row);
    }
    return Array.from(acc.values())
      .filter((r) => r.totalQty > 0.0001 || r.totalRevenueKurus !== 0)
      .sort((a, b) => b.totalRevenueKurus - a.totalRevenueKurus || b.totalQty - a.totalQty);
  }
}
