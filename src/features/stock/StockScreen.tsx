import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { getMarinaApi } from "../../api/marinaClient";
import { Category, Product, StockAgingRow, StockEntryLogRow } from "../../types/models";

interface Props {
  products: Product[];
  lowStock: Product[];
  categories: Category[];
  onStockChange: () => Promise<void>;
}

export function StockScreen({ products, lowStock, categories, onStockChange }: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState<number>(0);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryMessage, setCategoryMessage] = useState("");
  const [agingRows, setAgingRows] = useState<StockAgingRow[]>([]);
  const [entryLog, setEntryLog] = useState<StockEntryLogRow[]>([]);
  const [countedQty, setCountedQty] = useState("");
  const [adjustNote, setAdjustNote] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return products.filter((p) => {
      const textMatch = p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q);
      const categoryMatch = categoryFilter === 0 || p.categoryId === categoryFilter;
      return textMatch && categoryMatch;
    });
  }, [products, query, categoryFilter]);

  const addStock = async () => {
    if (!selectedId || qty <= 0) return;
    await getMarinaApi().addStock(selectedId, qty);
    await onStockChange();
  };

  const adjustStock = async () => {
    if (!selectedId) return;
    const counted = Number(countedQty);
    if (!Number.isFinite(counted) || counted < 0) return;
    await getMarinaApi().adjustStock(selectedId, counted, adjustNote.trim());
    setCountedQty("");
    setAdjustNote("");
    await onStockChange();
  };

  const createCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setCategoryMessage("");
    try {
      const category = await getMarinaApi().createCategory(name);
      setNewCategoryName("");
      setCategoryFilter(category.id);
      await onStockChange();
      setCategoryMessage(`Kategori eklendi: ${category.name}`);
    } catch (error) {
      setCategoryMessage(error instanceof Error ? error.message : "Kategori eklenemedi.");
    }
  };

  useEffect(() => {
    void getMarinaApi().getStockAging().then(setAgingRows).catch(() => setAgingRows([]));
    void getMarinaApi().getStockEntryLog().then(setEntryLog).catch(() => setEntryLog([]));
  }, [products]);

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
  };

  return (
    <div className="stock-layout">
      <section>
        <h2>Stok Listesi</h2>
        <div className="category-add">
          <input
            placeholder="Yeni kategori adi"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
          />
          <button type="button" onClick={() => void createCategory()}>
            Kategori Ekle
          </button>
        </div>
        {categoryMessage && <p className="form-message">{categoryMessage}</p>}
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(Number(e.target.value))}>
          <option value={0}>Tum kategoriler</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {filtered.map((p) => (
          <motion.div key={p.id} className="stock-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <span>{p.name}</span>
            <span>{p.stockQty}</span>
          </motion.div>
        ))}
      </section>
      <section>
        <h2>Eksik Liste (10 alti)</h2>
        {lowStock.map((p) => (
          <motion.div key={p.id} className="stock-row danger" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <span>{p.name}</span>
            <span>{p.stockQty}</span>
          </motion.div>
        ))}
      </section>
      <section>
        <h2>Stok Ekle</h2>
        <input placeholder="Ad, kod, barkod ara" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="search-results">
          {filtered.map((p) => (
            <motion.button whileHover={{ scale: 1.01 }} key={p.id} onClick={() => setSelectedId(p.id)} className={selectedId === p.id ? "selected" : ""}>
              {p.name} ({p.code}/{p.barcode})
            </motion.button>
          ))}
        </div>
        <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
        <button onClick={() => void addStock()}>Adet Ekle</button>
        <h3>Sayim Duzeltme</h3>
        <input
          type="number"
          min={0}
          placeholder="Sayilan gercek adet"
          value={countedQty}
          onChange={(e) => setCountedQty(e.target.value)}
        />
        <input
          placeholder="Duzeltme notu (opsiyonel)"
          value={adjustNote}
          onChange={(e) => setAdjustNote(e.target.value)}
        />
        <button onClick={() => void adjustStock()}>Sayim ile Duzelt</button>
      </section>
      <section>
        <h2>Stokta Kalma / Satis Suresi</h2>
        <div className="stock-aging-wrap">
          <div className="stock-aging-header">
            <span>Urun</span>
            <span>Stok</span>
            <span>Satilan</span>
            <span>Ort. satis suresi</span>
            <span>Mevcut stok yasi</span>
          </div>
          {agingRows.map((row) => (
            <motion.div key={row.productId} className="stock-aging-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <span title={row.productName}>{row.productName}</span>
              <span>{row.stockQty}</span>
              <span>{row.soldQty}</span>
              <span>{row.avgDaysToSell == null ? "-" : `${row.avgDaysToSell.toFixed(1)} gun`}</span>
              <span>{row.currentStockAgeDays == null ? "-" : `${row.currentStockAgeDays.toFixed(1)} gun`}</span>
            </motion.div>
          ))}
        </div>
      </section>
      <section>
        <h2>Stok Ekleme Gecmisi</h2>
        <div className="stock-aging-wrap">
          <div className="stock-entry-header">
            <span>Tarih/Saat</span>
            <span>Urun</span>
            <span>Kod</span>
            <span>Adet</span>
            <span>Not</span>
          </div>
          {entryLog.map((row) => (
            <motion.div key={row.movementId} className="stock-entry-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <span>{formatDateTime(row.createdAt)}</span>
              <span title={row.productName}>{row.productName}</span>
              <span>{row.productCode || "-"}</span>
              <span>+{row.qty}</span>
              <span title={row.note}>{row.note || "-"}</span>
            </motion.div>
          ))}
          {entryLog.length === 0 && <div className="stock-entry-row"><span>Kayit yok</span><span>-</span><span>-</span><span>-</span><span>-</span></div>}
        </div>
      </section>
    </div>
  );
}
