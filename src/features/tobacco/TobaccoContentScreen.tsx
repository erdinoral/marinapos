import { useCallback, useEffect, useState } from "react";
import { getMarinaApi } from "../../api/marinaClient";
import type { TobaccoAroma } from "../../types/models";
import { TobaccoAromaModal } from "./TobaccoAromaModal";

export function TobaccoContentScreen() {
  const [items, setItems] = useState<TobaccoAroma[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TobaccoAroma | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await getMarinaApi().listTobaccoAromas();
      setItems(Array.isArray(rows) ? rows : []);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (item: TobaccoAroma) => {
    setEditing(item);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  return (
    <div className="tobacco-layout">
      <header className="tobacco-header">
        <div className="tobacco-header-row">
          <div>
            <h2>Tütün icerikleri</h2>
            <p className="tobacco-lead">
              Aromalar kart olarak yan yana listelenir. Uzerine gelince icerik gorunur; karta tiklayarak duzenleyebilirsiniz.
            </p>
          </div>
          <button type="button" className="tobacco-btn-primary" onClick={openNew}>
            + Yeni aroma ekle
          </button>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="tobacco-cards-empty">
          <p className="muted">Henuz aroma yok.</p>
          <button type="button" className="tobacco-btn-primary" onClick={openNew}>
            Ilk aromayi ekle
          </button>
        </div>
      ) : (
        <div className="tobacco-cards-wrap" role="list">
          {items.map((item) => (
            <article
              key={item.id}
              role="listitem"
              className="tobacco-card"
              tabIndex={0}
              onClick={() => openEdit(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openEdit(item);
                }
              }}
            >
              <span className="tobacco-card-name">{item.name}</span>
              <div className="tobacco-card-hover" aria-hidden="true">
                <p className="tobacco-card-hover-label">Icerik</p>
                <p className="tobacco-card-hover-text">{item.content.trim() || "—"}</p>
              </div>
            </article>
          ))}
        </div>
      )}

      <TobaccoAromaModal open={modalOpen} editing={editing} onClose={closeModal} onSaved={load} />
    </div>
  );
}
