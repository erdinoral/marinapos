import { useEffect, useMemo, useRef, useState } from "react";
import type { Customer } from "../../types/models";

function customerRowLabel(c: Customer): string {
  if (c.kind === "wholesale") {
    return (c.companyName.trim() ? `${c.companyName.trim()} · ` : "") + c.name;
  }
  return c.name + (c.phone.trim() ? ` · ${c.phone.trim()}` : "");
}

interface Props {
  customers: Customer[];
  value: number | null;
  onChange: (customerId: number | null) => void;
}

function matchesCustomerSearch(c: Customer, q: string): boolean {
  if (!q) return true;
  const hay = [
    c.name,
    c.phone,
    c.email,
    c.companyName,
    c.note,
    c.taxOrVkn,
    c.city,
    c.district
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function PosCartCustomerSelect({ customers, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const q = search.trim().toLowerCase();
  const wholesale = useMemo(
    () => customers.filter((c) => c.kind === "wholesale" && matchesCustomerSearch(c, q)),
    [customers, q]
  );
  const retail = useMemo(
    () => customers.filter((c) => c.kind === "retail_regular" && matchesCustomerSearch(c, q)),
    [customers, q]
  );

  const selected = value != null ? customers.find((c) => c.id === value) : null;
  const triggerLabel = selected ? customerRowLabel(selected) : "— Musteri yok —";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => searchRef.current?.focus(), 0);
    } else {
      setSearch("");
    }
  }, [open]);

  const pick = (id: number | null) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="pos-cart-customer-dd" ref={rootRef}>
      <button
        type="button"
        className={`pos-cart-customer-dd-trigger${open ? " is-open" : ""}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="pos-cart-customer-dd-trigger-text">{triggerLabel}</span>
      </button>
      {open ? (
        <div className="pos-cart-customer-dd-panel" role="listbox" aria-label="Musteri listesi">
          <div className="pos-cart-customer-dd-search-wrap">
            <input
              ref={searchRef}
              type="search"
              className="pos-cart-customer-dd-search"
              placeholder="Ara: ad, telefon, firma…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              aria-label="Musteri ara"
            />
          </div>
          <button
            type="button"
            role="option"
            aria-selected={value == null}
            className={`pos-cart-customer-dd-option${value == null ? " is-active" : ""}`}
            onClick={() => pick(null)}
          >
            — Musteri yok —
          </button>
          {wholesale.length > 0 ? (
            <>
              <div className="pos-cart-customer-dd-group" role="presentation">
                Kafe
              </div>
              {wholesale.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={value === c.id}
                  className={`pos-cart-customer-dd-option${value === c.id ? " is-active" : ""}`}
                  onClick={() => pick(c.id)}
                >
                  <span className="pos-cart-customer-dd-option-label">{customerRowLabel(c)}</span>
                </button>
              ))}
            </>
          ) : null}
          {retail.length > 0 ? (
            <>
              <div className="pos-cart-customer-dd-group" role="presentation">
                Perakende musteri
              </div>
              {retail.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={value === c.id}
                  className={`pos-cart-customer-dd-option${value === c.id ? " is-active" : ""}`}
                  onClick={() => pick(c.id)}
                >
                  <span className="pos-cart-customer-dd-option-label">{customerRowLabel(c)}</span>
                </button>
              ))}
            </>
          ) : null}
          {q && wholesale.length === 0 && retail.length === 0 ? (
            <p className="pos-cart-customer-dd-empty muted small">Eslesen musteri yok.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
