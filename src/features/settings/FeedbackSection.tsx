import { useCallback, useEffect, useRef, useState } from "react";
import { getMarinaApi } from "../../api/marinaClient";
import type { FeedbackImagePayload, FeedbackReplyItem } from "../../types/models";
import { feedbackStatusTag } from "../../utils/feedbackStatus";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPT_IMAGE = "image/png,image/jpeg,image/webp,image/gif";
const SENT_FLASH_MS = 4000;

type Props = {
  companyName?: string;
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

function formatFeedbackDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function FeedbackSection({ companyName = "" }: Props) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replies, setReplies] = useState<FeedbackReplyItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);
  const sentFlashTimerRef = useRef<number | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [contactName, setContactName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const loadReplies = useCallback(async () => {
    if (!configured) return;
    setLoadingReplies(true);
    try {
      const rows = await getMarinaApi().listFeedbackReplies(companyName.trim() || undefined);
      setReplies(rows);
    } catch {
      setReplies([]);
    } finally {
      setLoadingReplies(false);
    }
  }, [configured, companyName]);

  useEffect(() => {
    void getMarinaApi()
      .isFeedbackConfigured()
      .then(setConfigured)
      .catch(() => setConfigured(false));
  }, []);

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

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMsgOk(false);
      setMsg("Yalnizca gorsel dosyasi secilebilir.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setMsgOk(false);
      setMsg("Gorsel en fazla 5 MB olabilir.");
      return;
    }
    setMsg("");
    setMsgOk(false);
    setImageFile(file);
  };

  const resetForm = () => {
    setTitle("");
    setBody("");
    setContactName("");
    clearImage();
  };

  const submit = useCallback(async () => {
    setMsg("");
    const t = title.trim();
    const b = body.trim();
    const n = contactName.trim();
    if (!t || !b || !n) {
      setMsgOk(false);
      setMsg("Baslik, sorun ve isim alanlari zorunludur.");
      return;
    }
    setSending(true);
    try {
      let image: FeedbackImagePayload | null = null;
      if (imageFile) {
        image = await readFileAsBase64Payload(imageFile);
      }
      await getMarinaApi().submitFeedback({
        title: t,
        body: b,
        contactName: n,
        companyName: companyName.trim() || undefined,
        image
      });
      resetForm();
      setShowHistory(false);
      setReplies([]);
      flashSent();
    } catch (e) {
      setMsgOk(false);
      setMsg(e instanceof Error ? e.message : "Gonderilemedi.");
    } finally {
      setSending(false);
    }
  }, [title, body, contactName, companyName, imageFile, flashSent]);

  return (
    <section className="settings-card settings-feedback-card">
      <div className="settings-card-head">
        <h3>Soru, gorus, oneri</h3>
        <div className="settings-card-actions">
          <button type="button" className="primary" disabled={sending || configured === false} onClick={() => void submit()}>
            {sending ? "Gonderiliyor..." : "Gonder"}
          </button>
        </div>
      </div>
      {configured === false ? (
        <p className="settings-feedback-offline muted small">
          Uzaktan gonderim yapilandirilmamis. Gecici olarak{" "}
          <a href="mailto:akiyom.iletisim@gmail.com">akiyom.iletisim@gmail.com</a> adresine yazabilirsiniz.
        </p>
      ) : (
        <>
          <div className="settings-feedback-form">
            <label className="settings-field">
              <span>Baslik</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kisa baslik" maxLength={200} />
            </label>
            <label className="settings-field settings-field-wide">
              <span>Sorun / aciklama</span>
              <textarea
                className="settings-feedback-textarea"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Ne oldu, ne bekliyordunuz?"
                rows={5}
                maxLength={8000}
              />
            </label>
            <label className="settings-field">
              <span>Isim</span>
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Adiniz" maxLength={120} />
            </label>
            <div className="settings-field settings-field-wide settings-feedback-image-field">
              <span>Gorsel (istege bagli)</span>
              <div className="settings-feedback-image-row">
                <label className="settings-feedback-upload-btn">
                  Gorsel yukle
                  <input type="file" accept={ACCEPT_IMAGE} className="settings-file-input-hidden" onChange={onPickImage} />
                </label>
                {imageFile ? (
                  <button type="button" className="settings-feedback-clear-image" onClick={clearImage}>
                    Kaldir
                  </button>
                ) : null}
              </div>
              {imagePreview ? (
                <img src={imagePreview} alt="Onizleme" className="settings-feedback-preview" />
              ) : (
                <p className="muted small">PNG, JPG, WEBP — en fazla 5 MB</p>
              )}
            </div>
          </div>

          <p className="muted small settings-feedback-history-hint">
            <button type="button" className="settings-feedback-refresh" onClick={toggleHistory}>
              {showHistory ? "Gonderdiginiz mesajlari gizle" : "Gonderdiginiz mesajlari goster"}
            </button>
          </p>
          {showHistory ? (
            <div className="settings-feedback-replies">
              <div className="settings-feedback-replies-head">
                <div>
                  <h4>Gonderdiginiz mesajlar</h4>
                  <p className="muted small settings-feedback-replies-hint">
                    Durum etiketi her mesajin basliginin yaninda gorunur. Panelden guncelledikten sonra <strong>Yenile</strong> tusuna
                    basin.
                  </p>
                </div>
                <button type="button" className="settings-feedback-refresh" disabled={loadingReplies} onClick={() => void loadReplies()}>
                  {loadingReplies ? "Yukleniyor..." : "Yenile"}
                </button>
              </div>
              {loadingReplies && replies.length === 0 ? (
                <p className="muted small">Mesajlar yukleniyor...</p>
              ) : replies.length === 0 ? (
                <p className="muted small">Henuz mesaj gondermediniz.</p>
              ) : (
                <ul className="settings-feedback-reply-list">
                  {replies.map((row) => {
                    const tag = feedbackStatusTag(row.status);
                    return (
                      <li key={row.id} className="settings-feedback-reply-item">
                        <div className="settings-feedback-reply-meta">
                          <strong>{row.title}</strong>
                          <span className={`settings-feedback-status-tag ${tag.className}`}>{tag.text}</span>
                          <span className="muted small">
                            {formatFeedbackDate(row.repliedAt || row.createdAt)}
                            {row.contactName ? ` · ${row.contactName}` : ""}
                          </span>
                        </div>
                        <p className="settings-feedback-reply-user">
                          <span className="settings-feedback-reply-label">Sizin mesajiniz</span>
                          {row.body}
                        </p>
                        {row.adminReply.trim() ? (
                          <p className="settings-feedback-reply-admin">
                            <span className="settings-feedback-reply-label">Akiyom yaniti</span>
                            {row.adminReply}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </>
      )}
      {msg ? <p className={`form-message${msgOk ? " form-message-ok" : ""}`}>{msg}</p> : null}
    </section>
  );
}
