import type { Supplier } from "../../types/models";
import { normalizeAlternateSupplierIds } from "../../utils/productSuppliers";

type Props = {
  suppliers: Supplier[];
  primarySupplierId: number;
  alternateSupplierIds: number[];
  disabled?: boolean;
  onChange: (primarySupplierId: number, alternateSupplierIds: number[]) => void;
};

function usedSupplierIds(primary: number, alternates: number[]): Set<number> {
  return new Set(
    normalizeAlternateSupplierIds(alternates, primary).concat(primary > 0 ? [primary] : [])
  );
}

export function ProductSuppliersField({
  suppliers,
  primarySupplierId,
  alternateSupplierIds,
  disabled = false,
  onChange
}: Props) {
  const alternates = normalizeAlternateSupplierIds(alternateSupplierIds, primarySupplierId);

  const availableForExtra = suppliers.filter((s) => !usedSupplierIds(primarySupplierId, alternates).has(s.id));

  const setPrimary = (id: number) => {
    const nextPrimary = Math.max(0, Math.floor(Number(id) || 0));
    const nextAlternates = alternates.filter((aid) => aid !== nextPrimary);
    onChange(nextPrimary, nextAlternates);
  };

  const setAlternateAt = (index: number, id: number) => {
    const next = [...alternates];
    next[index] = Math.max(0, Math.floor(Number(id) || 0));
    onChange(primarySupplierId, normalizeAlternateSupplierIds(next, primarySupplierId));
  };

  const removeAlternateAt = (index: number) => {
    onChange(
      primarySupplierId,
      alternates.filter((_, i) => i !== index)
    );
  };

  const addAlternate = () => {
    const pick = availableForExtra[0]?.id ?? 0;
    if (pick <= 0) return;
    onChange(
      primarySupplierId,
      normalizeAlternateSupplierIds([...alternates, pick], primarySupplierId)
    );
  };

  return (
    <div className="product-suppliers-field">
      <div className="product-suppliers-primary">
        <label className="product-suppliers-label">
          <span>Birincil tedarikci</span>
          <select value={primarySupplierId} disabled={disabled} onChange={(e) => setPrimary(Number(e.target.value))}>
            <option value={0}>Tedarikci yok</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="product-suppliers-add-btn"
          disabled={disabled || availableForExtra.length === 0}
          onClick={addAlternate}
          title="Ek tedarikci ekle"
        >
          +
        </button>
      </div>
      {alternates.map((aid, index) => (
        <div key={`alt-${index}-${aid}`} className="product-suppliers-extra-row">
          <label className="product-suppliers-label">
            <span>Tedarikci {index + 2}</span>
            <select value={aid} disabled={disabled} onChange={(e) => setAlternateAt(index, Number(e.target.value))}>
              {suppliers
                .filter(
                  (s) =>
                    s.id === aid ||
                    (!usedSupplierIds(primarySupplierId, alternates).has(s.id) && s.id !== primarySupplierId)
                )
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            className="product-suppliers-remove-btn"
            disabled={disabled}
            onClick={() => removeAlternateAt(index)}
            aria-label={`Tedarikci ${index + 2} kaldir`}
          >
            ×
          </button>
        </div>
      ))}
      <p className="product-suppliers-hint muted small">
        Ek tedarikci: urun toplu faturada o firmada da listelenir; stok girisinde yalnizca karttaki tedarikciler secilir.
      </p>
    </div>
  );
}
