import { useEffect, useState } from "react";
import { getMarinaApi } from "../../api/marinaClient";
import type { TobaccoAroma } from "../../types/models";

type Props = {
  open: boolean;
  editing: TobaccoAroma | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

export function TobaccoAromaModal({ open, editing, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFormError("");
    if (editing) {
      setName(editing.name);
      setContent(editing.content);
    } else {
      setName("");
      setContent("");
    }
  }, [open, editing]);

  if (!open) return null;

  const save = async () => {
    setFormError("");
    const n = name.trim();
    const c = content.trim();
    if (!n) {
      setFormError("Aroma adi gerekli.");
      return;
    }
    setSaving(true);
    try {
      const api = getMarinaApi();
      if (editing) {
        await api.updateTobaccoAroma(editing.id, { name: n, content: c, imagePath: "" });
      } else {
        await api.createTobaccoAroma({ name: n, content: c, imagePath: "" });
      }
      await onSaved();
      onClose();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!editing) return;
    if (!window.confirm(`"${editing.name}" silinsin mi?`)) return;
    setSaving(true);
    try {
      await getMarinaApi().deleteTobaccoAroma(editing.id);
      await onSaved();
      onClose();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Silinemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-dialog tobacco-aroma-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tobacco-aroma-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 id="tobacco-aroma-modal-title">{editing ? "Aromayi duzenle" : "Yeni aroma"}</h3>

        <label className="tobacco-field">
          <span>Aroma adi</span>
          <input
            className="tobacco-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ornek: Cift elma"
            autoFocus
          />
        </label>

        <label className="tobacco-field">
          <span>Aroma icerigi</span>
          <textarea
            className="tobacco-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Ornek: Elma aromali tütün karisimi..."
            rows={6}
          />
        </label>

        {formError ? <p className="tobacco-form-error">{formError}</p> : null}

        <div className="tobacco-modal-actions">
          {editing ? (
            <button type="button" className="tobacco-list-delete" disabled={saving} onClick={() => void onDelete()}>
              Sil
            </button>
          ) : null}
          <button type="button" className="tobacco-btn-ghost" disabled={saving} onClick={onClose}>
            Iptal
          </button>
          <button type="button" className="tobacco-btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? "Kaydediliyor..." : editing ? "Guncelle" : "Ekle"}
          </button>
        </div>
      </div>
    </div>
  );
}
