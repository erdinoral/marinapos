import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { getMarinaApi } from "../../api/marinaClient";
import type { TobaccoAroma } from "../../types/models";
import { resolveMediaImageSrc } from "../../utils/resolveMediaImageSrc";

const emptyForm = () => ({
  name: "",
  content: "",
  imagePath: ""
});

export function TobaccoContentScreen() {
  const [items, setItems] = useState<TobaccoAroma[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [mediaDir, setMediaDir] = useState("");
  const [formError, setFormError] = useState("");
  const [formOk, setFormOk] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => (selectedId != null ? items.find((x) => x.id === selectedId) ?? null : null),
    [items, selectedId]
  );

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

  useEffect(() => {
    const api = getMarinaApi();
    if (typeof api.getMediaDirectory !== "function") return;
    void api.getMediaDirectory().then((dir) => setMediaDir(String(dir ?? ""))).catch(() => setMediaDir(""));
  }, []);

  const fillForm = (item: TobaccoAroma | null) => {
    if (!item) {
      const f = emptyForm();
      setEditingId(null);
      setName(f.name);
      setContent(f.content);
      setImagePath(f.imagePath);
      return;
    }
    setEditingId(item.id);
    setName(item.name);
    setContent(item.content);
    setImagePath(item.imagePath ?? "");
  };

  const resetForm = () => {
    fillForm(null);
    setFormError("");
    setFormOk("");
  };

  const startNew = () => {
    setSelectedId(null);
    resetForm();
  };

  const selectItem = (item: TobaccoAroma) => {
    setSelectedId(item.id);
    fillForm(item);
    setFormError("");
    setFormOk("");
  };

  const selectImage = async () => {
    const selectedPath = await getMarinaApi().selectImage(name.trim() || "aroma");
    if (!selectedPath) return;
    setImagePath(selectedPath);
  };

  const save = async () => {
    setFormError("");
    setFormOk("");
    const n = name.trim();
    const c = content.trim();
    if (!n) {
      setFormError("Aroma adi gerekli.");
      return;
    }
    setSaving(true);
    try {
      const api = getMarinaApi();
      const img = imagePath.trim();
      if (editingId != null) {
        await api.updateTobaccoAroma(editingId, { name: n, content: c, imagePath: img });
        await load();
        setSelectedId(editingId);
        setFormOk("Guncellendi.");
      } else {
        const created = await api.createTobaccoAroma({ name: n, content: c, imagePath: img });
        await load();
        setSelectedId(created.id);
        fillForm(created);
        setFormOk("Eklendi.");
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (editingId == null && selectedId == null) return;
    const id = editingId ?? selectedId;
    if (id == null) return;
    if (!window.confirm("Bu aromayi silmek istediginize emin misiniz?")) return;
    await getMarinaApi().deleteTobaccoAroma(id);
    setSelectedId(null);
    resetForm();
    await load();
  };

  const formPreviewSrc = imagePath.trim() ? resolveMediaImageSrc(imagePath.trim()) : "";
  const detailImageSrc = selected?.imagePath?.trim() ? resolveMediaImageSrc(selected.imagePath) : "";

  return (
    <div className="tobacco-layout">
      <section className="products-panel tobacco-panel">
        <header className="tobacco-header">
          <div>
            <h2>Tütün icerikleri</h2>
            <p className="tobacco-lead">
              Solda tum kayitlar; ortada secilen aromanin icerigi ve gorseli; sagda duzenleme ve yeni ekleme.
            </p>
          </div>
        </header>

        <div className="tobacco-split tobacco-split--three">
          <aside className="tobacco-nav-panel">
            <div className="tobacco-nav-head">
              <h3 className="tobacco-col-title">Kayitlar ({items.length})</h3>
              <button type="button" className="tobacco-btn-primary tobacco-btn-compact" onClick={startNew}>
                + Yeni
              </button>
            </div>
            {items.length === 0 ? (
              <p className="tobacco-nav-empty muted small">Henuz kayit yok. + Yeni ile saga formu acip ekleyin.</p>
            ) : (
              <ul className="tobacco-nav-list">
                {items.map((item) => (
                  <motion.li key={item.id} layout>
                    <button
                      type="button"
                      className={`tobacco-nav-item${selectedId === item.id ? " tobacco-nav-item--active" : ""}`}
                      onClick={() => selectItem(item)}
                    >
                      <span className="tobacco-nav-item-name">{item.name}</span>
                      {item.imagePath?.trim() ? <span className="tobacco-nav-item-badge">Gorsel</span> : null}
                    </button>
                  </motion.li>
                ))}
              </ul>
            )}
          </aside>

          <div className="tobacco-detail-panel">
            <h3 className="tobacco-col-title">Icerik</h3>
            {!selected ? (
              <div className="tobacco-detail-empty">
                <p className="muted">Soldan bir kayit secin veya yeni aroma ekleyin.</p>
              </div>
            ) : (
              <div className="tobacco-detail-body">
                <h4 className="tobacco-detail-name">{selected.name}</h4>
                {detailImageSrc ? (
                  <div className="tobacco-detail-image-wrap">
                    <img src={detailImageSrc} alt={selected.name} className="tobacco-detail-image" />
                  </div>
                ) : (
                  <p className="tobacco-detail-no-image muted small">Bu kayitta gorsel yok.</p>
                )}
                <div className="tobacco-detail-content-block">
                  <p className="tobacco-detail-label">Aroma icerigi</p>
                  <p className="tobacco-detail-text">{selected.content.trim() || "—"}</p>
                </div>
              </div>
            )}
          </div>

          <aside className="tobacco-editor">
            <h3 className="tobacco-editor-title">{editingId != null ? "Duzenle" : "Yeni aroma"}</h3>

            <label className="tobacco-field">
              <span>Aroma adi</span>
              <input
                className="tobacco-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ornek: Cift elma"
              />
            </label>

            <label className="tobacco-field">
              <span>Aroma icerigi</span>
              <textarea
                className="tobacco-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Ornek: Elma aromali tütün karisimi..."
                rows={8}
              />
            </label>

            <div className="tobacco-field">
              <span>Gorsel</span>
              <div className="tobacco-image-row">
                <button type="button" className="tobacco-btn-ghost" onClick={() => void selectImage()}>
                  Gorsel sec
                </button>
                {imagePath.trim() ? (
                  <button type="button" className="tobacco-btn-ghost" onClick={() => setImagePath("")}>
                    Kaldir
                  </button>
                ) : null}
              </div>
              {formPreviewSrc ? (
                <div className="tobacco-image-preview-wrap">
                  <img src={formPreviewSrc} alt="" className="tobacco-image-preview" />
                </div>
              ) : (
                <p className="tobacco-image-hint muted small">PNG, JPG — urun resimleriyle ayni klasore kaydedilir.</p>
              )}
              {mediaDir ? <p className="tobacco-image-hint muted small">{mediaDir}</p> : null}
            </div>

            {formError ? <p className="tobacco-form-error">{formError}</p> : null}
            {formOk ? <p className="tobacco-form-ok">{formOk}</p> : null}

            <div className="tobacco-editor-actions">
              <button type="button" className="tobacco-btn-primary" disabled={saving} onClick={() => void save()}>
                {saving ? "Kaydediliyor..." : editingId != null ? "Guncelle" : "Ekle"}
              </button>
              {editingId != null ? (
                <button type="button" className="tobacco-btn-ghost" disabled={saving} onClick={startNew}>
                  Yeni kayit
                </button>
              ) : null}
              {editingId != null || selectedId != null ? (
                <button type="button" className="tobacco-list-delete tobacco-editor-delete" disabled={saving} onClick={() => void onDelete()}>
                  Sil
                </button>
              ) : null}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
