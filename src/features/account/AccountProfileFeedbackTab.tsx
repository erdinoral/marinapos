import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { getMarinaApi } from "../../api/marinaClient";
import type { AccountUser } from "../../types/account";
import type { FeedbackImagePayload, FeedbackReplyItem } from "../../types/models";
import { formatFeedbackDate } from "../../utils/feedbackFormat";
import { feedbackStatusTag } from "../../utils/feedbackStatus";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPT_IMAGE = "image/png,image/jpeg,image/webp,image/gif";
const SENT_FLASH_MS = 4000;

type Props = {
  user: AccountUser;
  companyName: string;
  feedbackConfigured: boolean;
};

function readFileAsBase64Payload(file: File): Promise<FeedbackImagePayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      const base64 = comma >= 0 ? result.slice(comma + 1) : result;
      resolve({
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
        base64
      });
    };
    reader.onerror = () => reject(new Error("Gorsel okunamadi."));
    reader.readAsDataURL(file);
  });
}

export function AccountProfileFeedbackTab({ user, companyName, feedbackConfigured }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [replies, setReplies] = useState<FeedbackReplyItem[]>([]);
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const sentFlashTimerRef = useRef<number | null>(null);

  const loadReplies = useCallback(async () => {
    if (!feedbackConfigured) return;
    setLoading(true);
    try {
      const rows = await getMarinaApi().listFeedbackForAccount(user.email);
      setReplies(rows);
    } catch {
      setReplies([]);
    } finally {
      setLoading(false);
    }
  }, [feedbackConfigured, user.email]);

  useEffect(() => {
    return () => {
      if (sentFlashTimerRef.current) window.clearTimeout(sentFlashTimerRef.current);
    };
  }, []);

  const flashSent = useCallback(() => {
    if (sentFlashTimerRef.current) window.clearTimeout(sentFlashTimerRef.current);
    setMsgOk(true);
    setMsg("Gorusunuz gonderildi.");
    sentFlashTimerRef.current = window.setTimeout(() => {
      setMsg("");
      setMsgOk(false);
      sentFlashTimerRef.current = null;
    }, SENT_FLASH_MS);
  }, []);

  const toggleHistory = () => {
    setShowHistory((open) => {
      if (open) return false;
      void loadReplies();
      return true;
    });
  };

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const onPickImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMsg("Yalnizca gorsel dosyasi secilebilir.");
      setMsgOk(false);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setMsg("Gorsel en fazla 5 MB olabilir.");
      setMsgOk(false);
      return;
    }
    setMsg("");
    setImageFile(file);
  };

  const submit = async () => {
    setMsg("");
    setMsgOk(false);
    const t = title.trim();
    const b = body.trim();
    if (!t || !b) {
      setMsg("Baslik ve aciklama zorunludur.");
      return;
    }
    setSending(true);
    try {
      let image: FeedbackImagePayload | null = null;
      if (imageFile) image = await readFileAsBase64Payload(imageFile);
      await getMarinaApi().submitFeedback({
        title: t,
        body: b,
        contactName: user.displayName.trim() || user.email,
        companyName: companyName.trim() || undefined,
        accountEmail: user.email,
        image
      });
      setTitle("");
      setBody("");
      setImageFile(null);
      setFormOpen(true);
      setShowHistory(false);
      setReplies([]);
      flashSent();
    } catch (e) {
      setMsgOk(false);
      setMsg(e instanceof Error ? e.message : "Gonderilemedi.");
    } finally {
      setSending(false);
    }
  };

  if (!feedbackConfigured) {
    return (
      <section className="account-panel-card account-profile-card">
        <p className="muted">
          Uzaktan geri bildirim kapali. Gecici olarak{" "}
          <a href="mailto:akiyom.iletisim@gmail.com">akiyom.iletisim@gmail.com</a> adresine yazabilirsiniz.
        </p>
      </section>
    );
  }

  return (
    <div className="account-profile-tab">
      <section className="account-panel-card account-profile-card">
        <div className="account-profile-section-head">
          <div>
            <h3 className="account-profile-card-title">Yeni gorus / oneri</h3>
            <p className="muted small account-profile-section-lead">
              Soru, hata bildirimi veya onerinizi buradan gonderin; hesabiniza baglanir.
            </p>
          </div>
          <button type="button" className="account-profile-toggle-btn" onClick={() => setFormOpen((v) => !v)}>
            {formOpen ? "Formu gizle" : "Yeni mesaj"}
          </button>
        </div>
        {formOpen ? (
          <div className="account-profile-feedback-form">
            <label className="account-field">
              <span>Baslik</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kisa baslik" maxLength={200} disabled={sending} />
            </label>
            <label className="account-field">
              <span>Aciklama</span>
              <textarea
                className="account-field-textarea"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Ne oldu, ne bekliyordunuz?"
                rows={4}
                maxLength={8000}
                disabled={sending}
              />
            </label>
            <div className="account-field">
              <span>Gorsel (istege bagli)</span>
              <div className="account-profile-image-row">
                <label className="account-profile-upload-btn">
                  Gorsel sec
                  <input type="file" accept={ACCEPT_IMAGE} className="settings-file-input-hidden" onChange={onPickImage} disabled={sending} />
                </label>
                {imageFile ? (
                  <button type="button" className="account-profile-link-btn" onClick={() => setImageFile(null)} disabled={sending}>
                    Kaldir
                  </button>
                ) : null}
              </div>
              {imagePreview ? (
                <img src={imagePreview} alt="Onizleme" className="account-profile-feedback-preview" />
              ) : (
                <p className="muted small">PNG, JPG, WEBP — en fazla 5 MB</p>
              )}
            </div>
            <button type="button" className="account-auth-submit" disabled={sending} onClick={() => void submit()}>
              {sending ? "Gonderiliyor…" : "Gonder"}
            </button>
          </div>
        ) : null}
        {msg ? <p className={`account-auth-message${msgOk ? " account-auth-message--ok" : ""}`}>{msg}</p> : null}
      </section>

      <p className="muted small account-profile-history-hint">
        <button type="button" className="account-profile-toggle-btn" onClick={toggleHistory}>
          {showHistory ? "Gonderdiginiz mesajlari gizle" : "Gonderdiginiz mesajlari goster"}
        </button>
      </p>
      {showHistory ? (
        <section className="account-panel-card account-profile-card">
          <div className="account-profile-section-head">
            <div>
              <h3 className="account-profile-card-title">Gonderdiginiz mesajlar</h3>
              <p className="muted small account-profile-section-lead">
                Durum ve Akiyom yaniti. Panel guncelledikten sonra yenileyin.
              </p>
            </div>
            <button type="button" className="account-profile-toggle-btn" disabled={loading} onClick={() => void loadReplies()}>
              {loading ? "Yukleniyor…" : "Yenile"}
            </button>
          </div>
          {loading && replies.length === 0 ? (
            <p className="muted small">Yukleniyor…</p>
          ) : replies.length === 0 ? (
            <p className="muted small">Henuz bu hesaptan mesaj yok.</p>
          ) : (
            <ul className="account-feedback-list">
              {replies.map((row) => {
                const tag = feedbackStatusTag(row.status);
                return (
                  <li key={row.id} className="account-feedback-item">
                    <div className="account-feedback-item-head">
                      <strong>{row.title}</strong>
                      <span className={`settings-feedback-status-tag ${tag.className}`}>{tag.text}</span>
                    </div>
                    <span className="account-feedback-item-date muted small">
                      {formatFeedbackDate(row.repliedAt || row.createdAt)}
                    </span>
                    <p className="account-feedback-item-body">
                      <span className="account-feedback-label">Sizin mesajiniz</span>
                      {row.body}
                    </p>
                    {row.adminReply.trim() ? (
                      <p className="account-feedback-item-admin">
                        <span className="account-feedback-label">Akiyom yaniti</span>
                        {row.adminReply}
                      </p>
                    ) : (
                      <p className="muted small account-feedback-pending">Henuz yanit yok.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
