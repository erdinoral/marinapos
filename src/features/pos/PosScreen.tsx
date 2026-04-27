import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getMarinaApi } from "../../api/marinaClient";
import { CartItem, PaymentType, Product, SaleKind, SaleRecord } from "../../types/models";
import { formatTry, tlToKurus } from "../../utils/currency";

interface Props {
  products: Product[];
  onSaleCompleted: () => Promise<void>;
}

function resolveImageSrc(imagePath: string) {
  if (!imagePath) return "";
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://") || imagePath.startsWith("data:") || imagePath.startsWith("file://")) {
    return imagePath;
  }
  const normalized = imagePath.replace(/\\/g, "/");
  return encodeURI(`file:///${normalized}`);
}

function formatSaleTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(11, 16);
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export function PosScreen({ products, onSaleCompleted }: Props) {
  const [today, setToday] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const [saleKind, setSaleKind] = useState<SaleKind>("sale");
  const [carts, setCarts] = useState<Array<{ id: number; name: string; items: CartItem[] }>>([{ id: 1, name: "Masa 1", items: [] }]);
  const [activeCartId, setActiveCartId] = useState(1);
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [paidAmountTl, setPaidAmountTl] = useState("");
  const [dailySales, setDailySales] = useState<SaleRecord[]>([]);

  const loadDailySales = useCallback(async () => {
    try {
      const rows = await getMarinaApi().getDailySales(today);
      setDailySales(rows);
    } catch {
      setDailySales([]);
    }
  }, [today]);

  useEffect(() => {
    void loadDailySales();
  }, [loadDailySales]);

  useEffect(() => {
    const timer = setInterval(() => {
      const nowDate = new Date().toISOString().slice(0, 10);
      setToday((prev) => {
        if (prev === nowDate) return prev;
        setCarts([{ id: 1, name: "Masa 1", items: [] }]);
        setActiveCartId(1);
        setSearch("");
        setPaidAmountTl("");
        setSaleKind("sale");
        return nowDate;
      });
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const activeCart = useMemo(() => carts.find((c) => c.id === activeCartId) ?? carts[0], [activeCartId, carts]);
  const cart = activeCart?.items ?? [];

  const salesSummary = useMemo(() => {
    const gross = dailySales.reduce((s, r) => s + r.subtotalKurus, 0);
    const cash = dailySales.filter((r) => r.paymentType === "cash").reduce((s, r) => s + r.subtotalKurus, 0);
    const card = dailySales.filter((r) => r.paymentType === "card").reduce((s, r) => s + r.subtotalKurus, 0);
    return { count: dailySales.length, grossKurus: gross, cashKurus: cash, cardKurus: card };
  }, [dailySales]);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(
      (p) => p.stockQty > 0 && (p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q))
    );
  }, [products, search]);

  const totalKurus = useMemo(() => cart.reduce((sum, item) => sum + item.priceKurus * item.qty, 0), [cart]);
  const paidAmountKurus = tlToKurus(Number(paidAmountTl || 0));
  const changeKurus = paymentType === "cash" ? paidAmountKurus - totalKurus : 0;

  const addToCart = (product: Product) => {
    setCarts((prev) => {
      return prev.map((cartRow) => {
        if (cartRow.id !== activeCartId) return cartRow;
        const existing = cartRow.items.find((x) => x.id === product.id);
        if (!existing) return { ...cartRow, items: [...cartRow.items, { ...product, qty: 1 }] };
        return {
          ...cartRow,
          items: cartRow.items.map((x) => (x.id === product.id ? { ...x, qty: x.qty + 1 } : x))
        };
      });
    });
  };

  const changeQty = (productId: number, delta: number) => {
    setCarts((prev) =>
      prev.map((cartRow) =>
        cartRow.id !== activeCartId
          ? cartRow
          : {
              ...cartRow,
              items: cartRow.items
                .map((item) => (item.id === productId ? { ...item, qty: item.qty + delta } : item))
                .filter((item) => item.qty > 0)
            }
      )
    );
  };

  const createNewCart = () => {
    setCarts((prev) => {
      const nextId = Math.max(...prev.map((c) => c.id), 0) + 1;
      const next = [...prev, { id: nextId, name: `Masa ${nextId}`, items: [] }];
      setActiveCartId(nextId);
      return next;
    });
  };

  const closeCart = (cartId: number) => {
    setCarts((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((c) => c.id !== cartId);
      if (activeCartId === cartId) {
        setActiveCartId(next[0].id);
      }
      return next;
    });
  };

  const completeSale = async () => {
    if (!cart.length) return;
    await getMarinaApi().createSale(
      cart.map((x) => ({ productId: x.id, qty: x.qty })),
      paymentType,
      paidAmountKurus,
      saleKind
    );
    setCarts((prev) => prev.map((x) => (x.id === activeCartId ? { ...x, items: [] } : x)));
    setPaidAmountTl("");
    await onSaleCompleted();
    await loadDailySales();
  };

  useEffect(() => {
    let scannerBuffer = "";
    let lastKeyMs = 0;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      const now = Date.now();
      if (now - lastKeyMs > 100) scannerBuffer = "";
      lastKeyMs = now;
      if (event.key === "Enter") {
        const barcode = scannerBuffer.trim();
        scannerBuffer = "";
        if (barcode.length < 4) return;
        setSearch(barcode);
        const found = products.find((p) => p.barcode === barcode && p.stockQty > 0);
        if (found) {
          setCarts((prev) =>
            prev.map((cartRow) => {
              if (cartRow.id !== activeCartId) return cartRow;
              const existing = cartRow.items.find((x) => x.id === found.id);
              if (!existing) return { ...cartRow, items: [...cartRow.items, { ...found, qty: 1 }] };
              return {
                ...cartRow,
                items: cartRow.items.map((x) => (x.id === found.id ? { ...x, qty: x.qty + 1 } : x))
              };
            })
          );
        }
        return;
      }
      if (event.key.length === 1) {
        scannerBuffer += event.key;
        setSearch(scannerBuffer);
        if (resetTimer) clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
          scannerBuffer = "";
        }, 250);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, [products, activeCartId]);

  return (
    <div className="pos-grid">
      <section className="products-panel">
        <label className="search-wrap">
          <span className="search-icon">⌕</span>
          <input
            className="search"
            placeholder="Ad, kod veya barkod ile ara"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="product-grid">
          {filteredProducts.length === 0 && (
            <div className="empty-silhouette">
              <span>🫧</span>
              <p>Urun bulunamadi. Barkod veya urun adi ile arayin.</p>
            </div>
          )}
          {filteredProducts.map((product) => (
            <motion.button
              layout
              whileHover={{ y: -2, borderColor: "#b88f43" }}
              whileTap={{ scale: 0.98 }}
              key={product.id}
              className="product-card"
              onClick={() => addToCart(product)}
            >
              <div className="price-tag">{formatTry(product.priceKurus)}</div>
              <div className="image-placeholder">
                {product.imagePath ? (
                  <img src={resolveImageSrc(product.imagePath)} alt={product.name} className="product-image" />
                ) : (
                  "Resim"
                )}
              </div>
              <strong>{product.name}</strong>
              <small>{product.description}</small>
              <small>Stok: {product.stockQty}</small>
              <small>Kod: {product.code} / Barkod: {product.barcode}</small>
            </motion.button>
          ))}
        </div>
      </section>

      <div className="pos-sidebar">
        <section className="cart-panel">
          <h2>Sepet</h2>
          <div className="payment-segment">
            {carts.map((c) => (
              <button key={c.id} className={activeCartId === c.id ? "active" : ""} onClick={() => setActiveCartId(c.id)}>
                {c.name} ({c.items.length})
              </button>
            ))}
            <button type="button" onClick={createNewCart}>+ Yeni</button>
            {carts.length > 1 && <button type="button" onClick={() => closeCart(activeCartId)}>Sepeti Kapat</button>}
          </div>
          <div className="payment-segment">
            <button className={saleKind === "sale" ? "active" : ""} onClick={() => setSaleKind("sale")}>Satis</button>
            <button className={saleKind === "return" ? "active" : ""} onClick={() => setSaleKind("return")}>Iade</button>
          </div>
          <AnimatePresence>
            {cart.map((item) => (
              <motion.div
                key={item.id}
                className="cart-row"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 18 }}
              >
                <span>{item.name}</span>
                <div className="cart-actions">
                  <button type="button" onClick={() => changeQty(item.id, -1)}>-</button>
                  <strong>{item.qty}</strong>
                  <button type="button" onClick={() => changeQty(item.id, 1)}>+</button>
                </div>
                <span>{formatTry(item.priceKurus * item.qty)}</span>
              </motion.div>
            ))}
          </AnimatePresence>
          <h3>{saleKind === "return" ? "Iade Toplami" : "Toplam"}: {formatTry(totalKurus)}</h3>
          <div className="payment-segment">
            <button className={paymentType === "cash" ? "active" : ""} onClick={() => setPaymentType("cash")}>
              Nakit
            </button>
            <button className={paymentType === "card" ? "active" : ""} onClick={() => setPaymentType("card")}>
              Kart
            </button>
          </div>
          {paymentType === "cash" && saleKind === "sale" ? (
            <>
              <input
                type="number"
                placeholder="Alinan para"
                value={paidAmountTl}
                onChange={(e) => setPaidAmountTl(e.target.value)}
              />
              <p>Para Ustu: {formatTry(changeKurus)}</p>
            </>
          ) : (
            <p>Cekilecek tutar: {formatTry(totalKurus)}</p>
          )}
          <button className="complete-btn" onClick={() => void completeSale()}>
            {saleKind === "return" ? "Iadeyi Tamamla" : "Satisi Tamamla"}
          </button>
        </section>

        <section className="sales-summary">
          <h2>Bugunun satislari</h2>
          <p className="sales-summary-date">{today}</p>
          <div className="sales-summary-totals">
            <div>
              <span className="sales-summary-label">Islem sayisi</span>
              <span className="sales-summary-value">{salesSummary.count}</span>
            </div>
            <div>
              <span className="sales-summary-label">Nakit toplam</span>
              <span className="sales-amount">{formatTry(salesSummary.cashKurus)}</span>
            </div>
            <div>
              <span className="sales-summary-label">Kart toplam</span>
              <span className="sales-amount">{formatTry(salesSummary.cardKurus)}</span>
            </div>
            <div className="sales-summary-gross">
              <span className="sales-summary-label">Gunluk ciro</span>
              <span className="sales-amount sales-amount-lg">{formatTry(salesSummary.grossKurus)}</span>
            </div>
          </div>
          <div className="sales-summary-list">
            {dailySales.length === 0 && <p className="sales-summary-empty">Bugun henuz satis yok.</p>}
            {dailySales.slice(0, 25).map((sale) => (
              <div key={sale.id} className="sales-summary-row">
                <span className="sales-summary-time">#{sale.id} · {formatSaleTime(sale.createdAt)}</span>
                <span className="sales-summary-pay">
                  {sale.kind === "return" ? "Iade" : "Satis"} · {sale.paymentType === "cash" ? "Nakit" : "Kart"}
                </span>
                <span className="sales-amount">{formatTry(sale.subtotalKurus)}</span>
              </div>
            ))}
            {dailySales.length > 25 && (
              <p className="sales-summary-more">+{dailySales.length - 25} satis daha (Excel ile tam liste)</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
