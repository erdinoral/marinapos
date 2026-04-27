import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getMarinaApi } from "../api/marinaClient";
import { ClosureScreen } from "../features/closure/ClosureScreen";
import { PosScreen } from "../features/pos/PosScreen";
import { StockScreen } from "../features/stock/StockScreen";
import { ProductForm } from "../features/products/ProductForm";
import { Category, Product, Settings } from "../types/models";

type Tab = "pos" | "stock" | "product" | "closure";

export function App() {
  const [tab, setTab] = useState<Tab>("pos");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Settings>({
    openingTime: "09:00",
    closureTime: "23:00",
    lowStockThreshold: 10,
    openingCashKurus: 0,
    openingCashDate: ""
  });

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [footerDate, setFooterDate] = useState(() => new Date().toISOString().slice(0, 10));

  const refresh = async () => {
    const api = getMarinaApi();
    const [productsResult, categoriesResult, lowStockResult, settingsResult] = await Promise.allSettled([
      api.listProducts(),
      api.listCategories(),
      api.lowStock(),
      api.getSettings()
    ]);

    if (productsResult.status === "fulfilled") setProducts(productsResult.value);
    if (categoriesResult.status === "fulfilled") setCategories(categoriesResult.value);
    if (lowStockResult.status === "fulfilled") setLowStock(lowStockResult.value);
    if (settingsResult.status === "fulfilled") setSettings(settingsResult.value);

    if (productsResult.status === "rejected") console.error("products:list error", productsResult.reason);
    if (categoriesResult.status === "rejected") console.error("categories:list error", categoriesResult.reason);
    if (lowStockResult.status === "rejected") console.error("products:low-stock error", lowStockResult.reason);
    if (settingsResult.status === "rejected") console.error("settings:get error", settingsResult.reason);
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="layout">
      <header className="topbar">
        <div className="brand">
          <h1>Marina Nargile Otomasyon</h1>
          <motion.span
            className="barcode-indicator"
            animate={{ opacity: [0.35, 1, 0.35], scale: [1, 1.2, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <div className="tabs">
          <button className={tab === "pos" ? "active" : ""} onClick={() => setTab("pos")}>Satis</button>
          <button className={tab === "stock" ? "active" : ""} onClick={() => setTab("stock")}>Stok</button>
          <button className={tab === "product" ? "active" : ""} onClick={() => setTab("product")}>Urun Ekle</button>
          <button className={tab === "closure" ? "active" : ""} onClick={() => setTab("closure")}>Kapanis</button>
          <button onClick={() => void getMarinaApi().exportXlsx(today)}>Excel Ciktisi</button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {tab === "pos" && (
          <motion.div key="pos" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <PosScreen products={products} onSaleCompleted={refresh} />
          </motion.div>
        )}
        {tab === "stock" && (
          <motion.div key="stock" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <StockScreen products={products} lowStock={lowStock} categories={categories} onStockChange={refresh} />
          </motion.div>
        )}
        {tab === "product" && (
          <motion.div
            key="product"
            className="tab-center-wrap"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <ProductForm categories={categories} onCreated={refresh} />
          </motion.div>
        )}
        {tab === "closure" && (
          <motion.div
            key="closure"
            className="tab-center-wrap"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <ClosureScreen settings={settings} />
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="footer">
        <div className="footer-left">
          <span>Acilis Saati: {settings.openingTime}</span>
          <input
            type="time"
            value={settings.openingTime}
            onChange={async (e) => {
              await getMarinaApi().setOpeningTime(e.target.value);
              await refresh();
            }}
          />
          <span>Kapanis Saati: {settings.closureTime}</span>
          <input
            type="time"
            value={settings.closureTime}
            onChange={async (e) => {
              await getMarinaApi().setClosureTime(e.target.value);
              await refresh();
            }}
          />
        </div>
        <div className="footer-right">
          <span>Takvim</span>
          <input type="date" value={footerDate} onChange={(e) => setFooterDate(e.target.value)} />
        </div>
      </footer>
    </div>
  );
}
