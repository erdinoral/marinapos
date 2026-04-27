import { useState } from "react";
import { motion } from "framer-motion";
import { getMarinaApi } from "../../api/marinaClient";
import { Category } from "../../types/models";
import { tlToKurus } from "../../utils/currency";

interface Props {
  categories: Category[];
  onCreated: () => Promise<void>;
}

const initialState = {
  name: "",
  description: "",
  barcode: "",
  code: "",
  priceTl: "",
  costTl: "",
  stockQty: 0,
  imagePath: "",
  categoryId: 0
};

function generateBarcode13() {
  const body = `869${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 10)}`;
  const digits = body.split("").map(Number);
  const sum = digits.reduce((acc, d, idx) => acc + d * (idx % 2 === 0 ? 1 : 3), 0);
  const checkDigit = (10 - (sum % 10)) % 10;
  return `${body}${checkDigit}`;
}

export function ProductForm({ categories, onCreated }: Props) {
  const [form, setForm] = useState(initialState);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [formMessage, setFormMessage] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMessage("");
    const name = form.name.trim();
    const code = form.code.trim();
    const barcode = form.barcode.trim();
    const priceTl = Number(form.priceTl);
    const costTl = Number(form.costTl || 0);
    const stockQty = Number(form.stockQty);

    if (
      !name ||
      !code ||
      !barcode ||
      !Number.isFinite(priceTl) ||
      priceTl <= 0 ||
      !Number.isFinite(costTl) ||
      costTl < 0 ||
      !Number.isFinite(stockQty) ||
      stockQty < 0 ||
      form.categoryId <= 0
    ) {
      setFormMessage("Lutfen zorunlu alanlari dogru doldurun.");
      return;
    }

    try {
      await getMarinaApi().createProduct({
        name,
        description: form.description.trim(),
        barcode,
        code,
        priceKurus: tlToKurus(priceTl),
        costPriceKurus: tlToKurus(costTl),
        stockQty,
        imagePath: form.imagePath.trim(),
        categoryId: form.categoryId
      });
      setForm(initialState);
      setFormMessage("Urun kaydedildi.");
      await onCreated();
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Kayit sirasinda bir hata olustu.");
    }
  };

  const createCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setFormMessage("");
    try {
      const category = await getMarinaApi().createCategory(name);
      setNewCategoryName("");
      setForm((prev) => ({ ...prev, categoryId: category.id }));
      setFormMessage(`Kategori secildi: ${category.name}`);
      await onCreated();
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Kategori eklenemedi.");
    }
  };

  const selectImage = async () => {
    const selectedPath = await getMarinaApi().selectImage();
    if (!selectedPath) return;
    setForm((prev) => ({ ...prev, imagePath: selectedPath }));
  };

  return (
    <motion.form
      className="product-form"
      onSubmit={(e) => void submit(e)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h2>Yeni Urun Ekle</h2>
      <input placeholder="Urun adi" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      <input placeholder="Aciklama" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <div className="category-add">
        <input
          placeholder="Kategori adi yaz"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
        />
        <button type="button" onClick={() => void createCategory()}>
          Kategori Ekle
        </button>
      </div>
      <select
        value={form.categoryId}
        onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}
        required
      >
        <option value={0} disabled>
          Kategori sec
        </option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <input placeholder="Kod" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
      <div className="image-input-row">
        <input placeholder="Barkod" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} required />
        <button type="button" onClick={() => setForm((prev) => ({ ...prev, barcode: generateBarcode13() }))}>
          Barkod Uret
        </button>
      </div>
      <input
        type="number"
        step="0.01"
        placeholder="Satis fiyati (TL)"
        value={form.priceTl}
        onChange={(e) => setForm({ ...form, priceTl: e.target.value })}
        required
      />
      <input
        type="number"
        step="0.01"
        min={0}
        placeholder="Gelis / maliyet (TL) birim"
        value={form.costTl}
        onChange={(e) => setForm({ ...form, costTl: e.target.value })}
      />
      <input type="number" min={0} placeholder="Ilk stok" value={String(form.stockQty)} onChange={(e) => setForm({ ...form, stockQty: Number(e.target.value) })} required />
      <div className="image-input-row">
        <input placeholder="Resim yolu (opsiyonel)" value={form.imagePath} onChange={(e) => setForm({ ...form, imagePath: e.target.value })} />
        <button type="button" onClick={() => void selectImage()}>
          Resim Sec
        </button>
      </div>
      {formMessage && <p className="form-message">{formMessage}</p>}
      <button type="submit">Kaydet</button>
    </motion.form>
  );
}
