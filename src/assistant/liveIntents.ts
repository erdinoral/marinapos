import { formatTlFromKurus } from "../utils/currency";
import type { LiveIntent, PosAssistantDataPort } from "./types";

function stockLabel(qty: number, unit: "piece" | "gram"): string {
  return unit === "gram" ? `${qty} g` : `${qty} adet`;
}

export const LIVE_INTENTS: LiveIntent[] = [
  {
    id: "today-sales",
    title: "Bugunun satislari",
    keywords: ["bugun", "satis", "ciro", "kac satis", "gunluk"],
    run: async (port) => {
      const s = await port.fetchTodaySalesSummary();
      const lines = [
        `Tarih: ${s.date}`,
        `Satis adedi: ${s.saleCount}`,
        `Iade: ${s.returnCount}`,
        `Ciro: ${formatTlFromKurus(s.revenueKurus)}`,
        `Kar (maliyet dusulmus): ${formatTlFromKurus(s.profitKurus)}`
      ];
      return lines.join("\n");
    }
  },
  {
    id: "low-stock",
    title: "Eksik stok",
    keywords: ["eksik", "dusuk stok", "az stok", "kritik stok", "biten"],
    run: async (port) => {
      const rows = await port.fetchLowStock();
      if (rows.length === 0) return "Eksik stokta urun yok (esik altinda kayit bulunamadi).";
      const head = rows.slice(0, 12);
      const lines = head.map(
        (r) => `• ${r.name} (${r.code}): ${stockLabel(r.stockQty, r.saleUnit)} / esik ${r.threshold}`
      );
      const more = rows.length > head.length ? `\n… ve ${rows.length - head.length} urun daha.` : "";
      return `Eksik stok (${rows.length} urun):\n${lines.join("\n")}${more}`;
    }
  },
  {
    id: "customer-debt-live",
    title: "Musteri borcu ozeti",
    keywords: ["musteri borc", "borclu musteri", "veresiye toplam", "perakende borc", "toptan borc"],
    run: async (port) => {
      const d = await port.fetchCustomerDebtSummary();
      if (d.debtorCount === 0) return "Acik musteri borcu yok.";
      const lines = [
        `Borclu musteri: ${d.debtorCount}`,
        `Perakende toplam: ${formatTlFromKurus(d.retailDebtKurus)}`,
        `Kafe toplam: ${formatTlFromKurus(d.wholesaleDebtKurus)}`
      ];
      if (d.topDebtors.length > 0) {
        lines.push("", "En yuksek bakiyeler:");
        for (const x of d.topDebtors) {
          lines.push(`• ${x.name} (${x.kind}): ${formatTlFromKurus(x.balanceKurus)}`);
        }
      }
      return lines.join("\n");
    }
  },
  {
    id: "supplier-debt-live",
    title: "Tedarikci borcu ozeti",
    keywords: ["tedarikci borc", "borclu tedarikci", "tedarikci bakiye"],
    run: async (port) => {
      const d = await port.fetchSupplierDebtSummary();
      if (d.debtorCount === 0) return "Acik tedarikci borcu yok.";
      const lines = [
        `Borclu tedarikci: ${d.debtorCount}`,
        `Toplam borc: ${formatTlFromKurus(d.totalDebtKurus)}`
      ];
      if (d.topDebtors.length > 0) {
        lines.push("", "Detay:");
        for (const x of d.topDebtors) {
          lines.push(`• ${x.name}: ${formatTlFromKurus(x.balanceKurus)}`);
        }
      }
      return lines.join("\n");
    }
  },
  {
    id: "dashboard-snapshot",
    title: "Genel ozet",
    keywords: ["ozet", "dashboard", "rapor", "toplam urun", "genel durum"],
    run: async (port) => {
      const d = await port.fetchDashboardSnapshot();
      return [
        `Urun sayisi: ${d.productsCount}`,
        `Eksik stok: ${d.lowStockCount} urun`,
        `Toplam satis (tum zaman): ${d.totalSalesCount} islem`,
        `Toplam ciro: ${formatTlFromKurus(d.revenueKurus)}`,
        `Toplam kar: ${formatTlFromKurus(d.profitKurus)}`
      ].join("\n");
    }
  },
  {
    id: "product-hint",
    title: "Urun stok ara",
    keywords: ["stok", "urun", "kac kaldi", "bakiye"],
    run: async (port) => {
      // engine, urun adini ayri iletir; burada placeholder — engine product query ile cagirir
      return "Urun adi veya kod yazin (ornek: \"cola stok\" veya sadece urun adi).";
    }
  }
];

/** Urun odakli canli sorgu (ayri intent skoru) */
export async function runProductStockHint(port: PosAssistantDataPort, productQuery: string): Promise<string | null> {
  const hint = await port.findProductHint(productQuery);
  return hint;
}
