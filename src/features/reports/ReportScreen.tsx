import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getMarinaApi } from "../../api/marinaClient";
import { DashboardReport, TopSellingProduct } from "../../types/models";
import { formatTry } from "../../utils/currency";

export function ReportScreen() {
  const [dashboard, setDashboard] = useState<DashboardReport | null>(null);
  const [topSelling, setTopSelling] = useState<TopSellingProduct[]>([]);

  useEffect(() => {
    const loadReport = async () => {
      try {
        const api = getMarinaApi();
        const [dash, tops] = await Promise.all([api.getDashboardReport(), api.getTopSellingProducts(20)]);
        setDashboard(dash);
        setTopSelling(tops);
      } catch {
        setDashboard(null);
        setTopSelling([]);
      }
    };
    void loadReport();
  }, []);

  return (
    <motion.div className="report-screen" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <h2>Rapor</h2>
      <p className="closure-help small">Uygulama genelinin anlik ozeti ve en cok satilan urunler burada listelenir.</p>

      {dashboard ? (
        <>
          <div className="report-stats report-stats-big">
            <div><span>Kategori</span><strong>{dashboard.categoriesCount}</strong></div>
            <div><span>Urun</span><strong>{dashboard.activeProductsCount} / {dashboard.productsCount}</strong></div>
            <div><span>Dusuk stok</span><strong>{dashboard.lowStockCount}</strong></div>
            <div><span>Toplam satis</span><strong>{dashboard.salesCount}</strong></div>
            <div><span>Nakit</span><strong>{formatTry(dashboard.cashKurus)}</strong></div>
            <div><span>Kart</span><strong>{formatTry(dashboard.cardKurus)}</strong></div>
            <div><span>Ciro</span><strong>{formatTry(dashboard.revenueKurus)}</strong></div>
            <div><span>Maliyet</span><strong>{formatTry(dashboard.costKurus)}</strong></div>
            <div><span>Kar</span><strong>{formatTry(dashboard.profitKurus)}</strong></div>
            <div><span>Kapanis kaydi</span><strong>{dashboard.closuresCount}</strong></div>
            <div><span>Stok hareketi</span><strong>{dashboard.stockMovementsCount}</strong></div>
          </div>
          <section className="report-top-section">
            <h3>Sepet Bazli Satis Ozeti</h3>
            {dashboard.cartSummaries.length > 0 ? (
              <div className="report-top-list report-top-list-big">
                {dashboard.cartSummaries.map((row) => (
                  <div key={row.cartName} className="report-top-row">
                    <span>{row.cartName}</span>
                    <small>{row.salesCount} satis</small>
                    <small>Ortalama: {formatTry(row.avgSaleKurus)}</small>
                    <strong>Toplam: {formatTry(row.totalKurus)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="report-empty">Sepet kaydi bulunamadi.</p>
            )}
          </section>
        </>
      ) : (
        <p className="report-empty">Rapor verisi yuklenemedi.</p>
      )}

      <section className="report-top-section">
        <h3>En Cok Satilanlar (Genel)</h3>
        {topSelling.length > 0 ? (
          <div className="report-top-list report-top-list-big">
            {topSelling.map((p, idx) => (
              <div key={p.productId} className="report-top-row">
                <span>{idx + 1}. {p.productName}</span>
                <small>{p.productCode || "-"}</small>
                <strong>{p.qty.toFixed(2)} satildi</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="report-empty">Henuz satis yok.</p>
        )}
      </section>
    </motion.div>
  );
}
