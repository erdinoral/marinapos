import { getMarinaApi } from "../../api/marinaClient";
import { totalDebtKurusByKind } from "../../utils/customerDebt";
import { suppliersWithDebt, totalSupplierDebtKurus } from "../../utils/supplierDebt";
import { categorySaleUnitOf, formatQtyShort } from "../../utils/saleUnit";
import { formatTlFromKurus } from "../../utils/currency";
import { saleCollectedKurus } from "../../utils/saleCollected";
import type {
  CustomerDebtSummary,
  DashboardSnapshot,
  LowStockRow,
  PosAssistantDataPort,
  SupplierDebtSummary,
  TodaySalesSummary
} from "../types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createMarinaAssistantDataPort(): PosAssistantDataPort {
  return {
    getTodayIso: todayIso,

    async fetchLowStock(): Promise<LowStockRow[]> {
      const api = getMarinaApi();
      const [products, categories, settings] = await Promise.all([
        api.listProducts(),
        api.listCategories(),
        api.getSettings()
      ]);
      const threshold = settings.lowStockThreshold ?? 10;
      const low = await api.lowStock();
      const byId = new Map(products.map((p) => [p.id, p]));
      return low.map((p) => {
        const full = byId.get(p.id) ?? p;
        const unit = categorySaleUnitOf(categories, full.categoryId);
        return {
          name: full.name,
          code: full.code,
          stockQty: full.stockQty,
          threshold,
          saleUnit: unit
        };
      });
    },

    async fetchTodaySalesSummary(): Promise<TodaySalesSummary> {
      const api = getMarinaApi();
      const date = todayIso();
      const [sales, profit] = await Promise.all([api.getDailySales(date), api.getDayProfitDetail(date)]);
      const saleRows = sales.filter((s) => (s.kind ?? "sale") === "sale");
      const debtPayments = sales.filter((s) => s.kind === "debt_payment");
      const returns = sales.filter((s) => s.kind === "return");
      const revenueKurus = sales.reduce((a, s) => a + saleCollectedKurus(s), 0);
      return {
        date,
        saleCount: saleRows.length + debtPayments.length,
        returnCount: returns.length,
        revenueKurus,
        profitKurus: profit.profitKurus
      };
    },

    async fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
      const api = getMarinaApi();
      const r = await api.getDashboardReport();
      return {
        productsCount: r.productsCount,
        lowStockCount: r.lowStockCount,
        totalSalesCount: r.salesCount,
        revenueKurus: r.revenueKurus,
        profitKurus: r.profitKurus
      };
    },

    async fetchCustomerDebtSummary(): Promise<CustomerDebtSummary> {
      const api = getMarinaApi();
      const customers = await api.listCustomers();
      const debtors = customers
        .filter((c) => c.balanceOwedKurus > 0)
        .sort((a, b) => b.balanceOwedKurus - a.balanceOwedKurus);
      const kindLabel = (k: string) => (k === "wholesale" ? "Kafe" : "Perakende");
      return {
        retailDebtKurus: totalDebtKurusByKind(customers, "retail_regular"),
        wholesaleDebtKurus: totalDebtKurusByKind(customers, "wholesale"),
        debtorCount: debtors.length,
        topDebtors: debtors.slice(0, 5).map((c) => ({
          name: c.name,
          balanceKurus: c.balanceOwedKurus,
          kind: kindLabel(c.kind)
        }))
      };
    },

    async fetchSupplierDebtSummary(): Promise<SupplierDebtSummary> {
      const api = getMarinaApi();
      const suppliers = await api.listSuppliers();
      const debtors = suppliersWithDebt(suppliers);
      return {
        totalDebtKurus: totalSupplierDebtKurus(suppliers),
        debtorCount: debtors.length,
        topDebtors: debtors.slice(0, 5).map((s) => ({ name: s.name, balanceKurus: s.balanceOwedKurus }))
      };
    },

    async findProductHint(query: string): Promise<string | null> {
      const api = getMarinaApi();
      const [products, categories] = await Promise.all([api.listProducts(), api.listCategories()]);
      const q = query.trim().toLocaleLowerCase("tr-TR");
      if (q.length < 2) return null;

      const matches = products.filter(
        (p) =>
          p.name.toLocaleLowerCase("tr-TR").includes(q) ||
          p.code.toLocaleLowerCase("tr-TR").includes(q) ||
          p.barcode.toLocaleLowerCase("tr-TR").includes(q)
      );
      if (matches.length === 0) return null;

      const p = matches[0];
      const unit = categorySaleUnitOf(categories, p.categoryId);
      const lines = [
        `Urun: ${p.name} (${p.code})`,
        `Stok: ${formatQtyShort(p.stockQty, unit)}`,
        `Satis fiyati: ${formatTlFromKurus(p.priceKurus)}`,
        `Aktif maliyet (FIFO basi): ${formatTlFromKurus(p.costPriceKurus)}`
      ];
      if (matches.length > 1) {
        lines.push("", `Not: ${matches.length} eslesme; ilki gosterildi.`);
      }
      return lines.join("\n");
    }
  };
}
