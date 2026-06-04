import { useCallback, useEffect, useMemo, useState } from "react";
import { AssistantFloating } from "../assistant";
import { AnimatePresence, motion } from "framer-motion";
import { getMarinaApi } from "../api/marinaClient";
import { ClosureScreen } from "../features/closure/ClosureScreen";
import { PosScreen } from "../features/pos/PosScreen";
import { StockScreen } from "../features/stock/StockScreen";
import { CategoryForm } from "../features/products/CategoryForm";
import { ProductForm } from "../features/products/ProductForm";
import { LegalKind, LegalModal } from "../features/legal/LegalModal";
import { TableScreen } from "../features/reports/TableScreen";
import { ReportScreen } from "../features/reports/ReportScreen";
import { CashflowScreen } from "../features/cashflow/CashflowScreen";
import { MonthEndReportScreen } from "../features/reports/MonthEndReportScreen";
import { ReportMonthEndBanner } from "../features/reports/ReportMonthEndBanner";
import { SettingsScreen } from "../features/settings/SettingsScreen";
import { AccountScreen } from "../features/account/AccountScreen";
import { TobaccoContentScreen } from "../features/tobacco/TobaccoContentScreen";
import { SplashScreen } from "../features/splash/SplashScreen";
import { LicenseLockScreen } from "../features/license/LicenseLockScreen";
import { LICENSE_CHECK_INTERVAL_MS } from "../config/license";
import { Category, LicenseStatus, Product, Settings, Supplier } from "../types/models";
import logoSrc from "../assets/marina-logo.png";
import { BrandTitle, DEFAULT_APP_TITLE } from "./BrandTitle";
import { useKeyboardFocusRecovery } from "../hooks/useKeyboardFocusRecovery";

type Tab = "pos" | "tobacco" | "stock" | "product" | "closure" | "table" | "report" | "account" | "settings";
type ReportSubTab = "dashboard" | "cashflow" | "monthend";

export function App() {
  useKeyboardFocusRecovery();
  const [showSplash, setShowSplash] = useState(true);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [licenseChecking, setLicenseChecking] = useState(false);
  const [legalOpen, setLegalOpen] = useState<LegalKind | null>(null);
  const [tab, setTab] = useState<Tab>("pos");
  const [reportSub, setReportSub] = useState<ReportSubTab>("dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Settings>({
    openingTime: "09:00",
    closureTime: "23:00",
    lowStockThreshold: 10,
    openingCashKurus: 0,
    openingCashDate: "",
    appTitle: DEFAULT_APP_TITLE,
    companyName: "Marina Nargile Hookah World",
    companyAddress: "",
    companyPhone: "",
    companyEmail: "",
    taxOffice: "",
    taxNumber: ""
  });

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const assistantConfig = useMemo(
    () => ({ displayName: "Akiyom Asistan", labMode: false, version: "1.5" }),
    []
  );
  const [footerDate, setFooterDate] = useState(() => new Date().toISOString().slice(0, 10));

  const refresh = useCallback(async () => {
    const api = getMarinaApi();
    const [productsResult, categoriesResult, suppliersResult, lowStockResult, settingsResult] = await Promise.allSettled([
      api.listProducts(),
      api.listCategories(),
      api.listSuppliers(),
      api.lowStock(),
      api.getSettings()
    ]);

    if (productsResult.status === "fulfilled") setProducts(productsResult.value);
    if (categoriesResult.status === "fulfilled") setCategories(categoriesResult.value);
    if (suppliersResult.status === "fulfilled") setSuppliers(suppliersResult.value);
    if (lowStockResult.status === "fulfilled") setLowStock(lowStockResult.value);
    if (settingsResult.status === "fulfilled") setSettings(settingsResult.value);

    if (productsResult.status === "rejected") console.error("products:list error", productsResult.reason);
    if (categoriesResult.status === "rejected") console.error("categories:list error", categoriesResult.reason);
    if (suppliersResult.status === "rejected") console.error("suppliers:list error", suppliersResult.reason);
    if (lowStockResult.status === "rejected") console.error("products:low-stock error", lowStockResult.reason);
    if (settingsResult.status === "rejected") console.error("settings:get error", settingsResult.reason);
  }, []);

  const runLicenseCheck = useCallback(async () => {
    const api = getMarinaApi();
    if (typeof api.checkLicense !== "function") {
      setLicenseStatus({
        state: "active",
        deviceId: "—",
        message: "",
        lastCheckAt: null,
        canRetry: false
      });
      return;
    }
    setLicenseChecking(true);
    try {
      const status = await api.checkLicense();
      setLicenseStatus(status);
    } catch {
      setLicenseStatus({
        state: "offline_expired",
        deviceId: "—",
        message: "Lisans kontrolu yapilamadi. Internet baglantinizi kontrol edin.",
        lastCheckAt: null,
        canRetry: true
      });
    } finally {
      setLicenseChecking(false);
    }
  }, []);

  const activateLicense = useCallback(async (licenseKey: string) => {
    const api = getMarinaApi();
    if (typeof api.activateLicense !== "function") {
      throw new Error("Lisans API yok. Uygulamayi Electron ile acin (npm run dev veya kurulum .exe).");
    }
    setLicenseChecking(true);
    try {
      const status = await api.activateLicense(licenseKey);
      setLicenseStatus(status);
      if (status.state !== "active") {
        throw new Error(status.message?.trim() || "Lisans aktif edilemedi. Anahtar veya Supabase kaydini kontrol edin.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Anahtar gecersiz.";
      setLicenseStatus((prev) => ({
        state: "needs_activation",
        deviceId: prev?.deviceId ?? "—",
        message: msg,
        lastCheckAt: prev?.lastCheckAt ?? null,
        canRetry: true,
        hasActivationKey: false
      }));
      throw e;
    } finally {
      setLicenseChecking(false);
    }
  }, []);

  /** Ilk acilista veriyi yukle; splash en az 2.3s kalsin (animasyon gorunsun). */
  useEffect(() => {
    let cancelled = false;
    const minSplashMs = 2300;
    const t0 = performance.now();
    void (async () => {
      try {
        await Promise.all([refresh(), runLicenseCheck()]);
      } finally {
        if (cancelled) return;
        const elapsed = performance.now() - t0;
        const wait = Math.max(0, minSplashMs - elapsed);
        window.setTimeout(() => {
          if (!cancelled) setShowSplash(false);
        }, wait);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, runLicenseCheck]);

  useEffect(() => {
    if (showSplash) return;
    const id = window.setInterval(() => void runLicenseCheck(), LICENSE_CHECK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [showSplash, runLicenseCheck]);

  if (showSplash) {
    return <SplashScreen />;
  }

  if (!licenseStatus || licenseStatus.state !== "active") {
    return (
      <LicenseLockScreen
        status={licenseStatus}
        checking={licenseChecking}
        onRetry={() => runLicenseCheck()}
        onActivate={(key) => activateLicense(key)}
      />
    );
  }

  return (
    <div className="layout">
      <motion.div key="app" className="app-shell" initial={{ opacity: 0.2 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
      <header className="topbar">
        <div className="brand">
          <img src={logoSrc} alt="Marina Nargile" className="brand-logo" />
          <BrandTitle
            title={settings.appTitle?.trim() || DEFAULT_APP_TITLE}
            onSave={async (appTitle) => {
              await getMarinaApi().setCompanyInfo({ appTitle });
              setSettings((s) => ({ ...s, appTitle }));
            }}
          />
          <motion.span
            className="barcode-indicator"
            animate={{ opacity: [0.35, 1, 0.35], scale: [1, 1.2, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <nav className="tabs tabs-main" aria-label="Ana menu">
          <button className={tab === "pos" ? "active" : ""} onClick={() => setTab("pos")}>Satis</button>
          <button className={tab === "tobacco" ? "active" : ""} onClick={() => setTab("tobacco")}>Tütün</button>
          <button className={tab === "stock" ? "active" : ""} onClick={() => setTab("stock")}>Stok</button>
          <button className={tab === "product" ? "active" : ""} onClick={() => setTab("product")}>Urun Ekle</button>
          <button className={tab === "closure" ? "active" : ""} onClick={() => setTab("closure")}>
            Kapanış
          </button>
          <button className={tab === "table" ? "active" : ""} onClick={() => setTab("table")}>Tablo</button>
          <button className={tab === "report" ? "active" : ""} onClick={() => setTab("report")}>Rapor</button>
        </nav>
        <div className="tabs tabs-settings">
          <button className={tab === "account" ? "active" : ""} onClick={() => setTab("account")}>Hesap</button>
          <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>Ayarlar</button>
        </div>
      </header>

      {/* Satis sekmesi: sepet state korunur; baska sekmeye gecince gizlenir, bosaltilmaz */}
      <div className={tab === "pos" ? "pos-tab-shell" : "pos-tab-shell app-tab-panel-hidden"} aria-hidden={tab !== "pos"}>
        <PosScreen
          products={products}
          categories={categories}
          suppliers={suppliers}
          lowStockThreshold={settings.lowStockThreshold}
          onSaleCompleted={refresh}
          onDataRefresh={refresh}
        />
      </div>

      <AnimatePresence mode="wait">
        {tab === "tobacco" && (
          <motion.div key="tobacco" className="app-tab-content" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <TobaccoContentScreen />
          </motion.div>
        )}
        {tab === "stock" && (
          <motion.div key="stock" className="app-tab-content" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <StockScreen
              products={products}
              lowStock={lowStock}
              categories={categories}
              suppliers={suppliers}
              lowStockThreshold={settings.lowStockThreshold}
              onStockChange={refresh}
            />
          </motion.div>
        )}
        {tab === "product" && (
          <motion.div
            key="product"
            className="app-tab-content tab-center-wrap product-tab-wrap"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="product-tab-grid">
              <ProductForm categories={categories} suppliers={suppliers} products={products} onCreated={refresh} />
              <CategoryForm categories={categories} suppliers={suppliers} products={products} onCreated={refresh} />
            </div>
          </motion.div>
        )}
        {tab === "closure" && (
          <motion.div
            key="closure"
            className="app-tab-content tab-center-wrap"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <ClosureScreen settings={settings} />
          </motion.div>
        )}
        {tab === "table" && (
          <motion.div key="table" className="app-tab-content" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <TableScreen />
          </motion.div>
        )}
        {tab === "report" && (
          <motion.div key="report" className="app-tab-content" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="report-tab-shell">
              <ReportMonthEndBanner
                settings={settings}
                active={tab === "report"}
                onGoMonthEnd={() => setReportSub("monthend")}
              />
              <div className="report-subtabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  className={reportSub === "dashboard" ? "active" : ""}
                  onClick={() => setReportSub("dashboard")}
                >
                  Genel rapor
                </button>
                <button
                  type="button"
                  role="tab"
                  className={reportSub === "cashflow" ? "active" : ""}
                  onClick={() => setReportSub("cashflow")}
                >
                  Gelir / Gider
                </button>
                <button
                  type="button"
                  role="tab"
                  className={reportSub === "monthend" ? "active" : ""}
                  onClick={() => setReportSub("monthend")}
                >
                  Ay sonu
                </button>
              </div>
              {reportSub === "dashboard" ? <ReportScreen /> : reportSub === "cashflow" ? <CashflowScreen /> : <MonthEndReportScreen />}
            </div>
          </motion.div>
        )}
        {tab === "account" && (
          <motion.div key="account" className="app-tab-content" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <AccountScreen
              onOpenSettings={() => setTab("settings")}
              onOpenLegal={setLegalOpen}
              onCompanySaved={refresh}
            />
          </motion.div>
        )}
        {tab === "settings" && (
          <motion.div key="settings" className="app-tab-content" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <SettingsScreen onSettingsChange={refresh} />
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="footer">
        <div className="footer-left">
          <div className="footer-company">
            <strong>{settings.companyName.trim() || "Marina Nargile Hookah World"}</strong>
            <span>Akiyom Tum haklari saklidir. 2026.</span>
          </div>
          <div className="footer-policies">
            <button type="button" onClick={() => setLegalOpen("kvkk")}>KVKK Aydinlatma</button>
            <button type="button" onClick={() => setLegalOpen("privacy")}>Gizlilik Politikasi</button>
            <button type="button" onClick={() => setLegalOpen("terms")}>Kullanim Kosullari</button>
          </div>
        </div>
        <div className="footer-middle">
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
      <LegalModal open={legalOpen !== null} kind={legalOpen} onClose={() => setLegalOpen(null)} />
      <AssistantFloating config={assistantConfig} />
      </motion.div>
    </div>
  );
}
