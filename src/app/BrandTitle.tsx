import { useEffect, useRef, useState } from "react";

export const DEFAULT_APP_TITLE = "Marina Nargile Otomasyon";

type Props = {
  title: string;
  onSave: (title: string) => Promise<void>;
};

export function BrandTitle({ title, onSave }: Props) {
  const display = title.trim() || DEFAULT_APP_TITLE;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(display);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(display);
  }, [display, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const cancel = () => {
    setDraft(display);
    setEditing(false);
  };

  const save = async () => {
    const next = draft.trim() || DEFAULT_APP_TITLE;
    if (next === display) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Baslik kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <form
        className="brand-title-edit-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          className="brand-title-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={saving}
          maxLength={80}
          placeholder={DEFAULT_APP_TITLE}
          aria-label="Uygulama basligi"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
        />
        <button type="submit" className="brand-title-btn brand-title-btn--ok" disabled={saving} title="Kaydet">
          {saving ? "…" : "✓"}
        </button>
        <button type="button" className="brand-title-btn" disabled={saving} onClick={cancel} title="Iptal">
          ✕
        </button>
      </form>
    );
  }

  return (
    <h1 className="brand-title-display" title="Basligi duzenlemek icin tiklayin veya kaleme basin">
      <button type="button" className="brand-title-text-btn" onClick={() => setEditing(true)}>
        {display}
      </button>
      <button
        type="button"
        className="brand-title-edit-btn"
        aria-label="Uygulama basligini duzenle"
        onClick={() => setEditing(true)}
      >
        ✎
      </button>
    </h1>
  );
}
