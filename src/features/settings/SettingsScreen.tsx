import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { getMarinaApi } from "../../api/marinaClient";
import type { BackupModuleId } from "../../types/backup";
import { BackupFileInfo, BackupInspectResult, ErrorLogEntry, Settings } from "../../types/models";
import { BackupScopeModal } from "./BackupScopeModal";
import { AppUpdateSection } from "./AppUpdateSection";
import { FeedbackSection } from "./FeedbackSection";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

type ScopeModalState =
  | { mode: "backup" }
  | { mode: "restore"; inspect: BackupInspectResult; backupName?: string; jsonText?: string };

export function SettingsScreen() {
  const [backups, setBackups] = useState<BackupFileInfo[]>([]);
  const [logs, setLogs] = useState<ErrorLogEntry[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [scopeModal, setScopeModal] = useState<ScopeModalState | null>(null);
  const [backupsOpen, setBackupsOpen] = useState(false);
  const restoreFileRef = useRef<HTMLInputElement | null>(null);
  const [company, setCompany] = useState<Pick<Settings, "companyName" | "companyAddress" | "companyPhone" | "companyEmail" | "taxOffice" | "taxNumber">>({
    companyName: "",
    companyAddress: "",
    companyPhone: "",
    companyEmail: "",
    taxOffice: "",
    taxNumber: ""
  });

  const load = useCallback(async () => {
    try {
      const api = getMarinaApi();
      const [b, l, s] = await Promise.all([api.listBackups(), api.listLogs(120), api.getSettings()]);
      setBackups(b);
      setLogs(l);
      setCompany({
        companyName: s.companyName ?? "",
        companyAddress: s.companyAddress ?? "",
        companyPhone: s.companyPhone ?? "",
        companyEmail: s.companyEmail ?? "",
        taxOffice: s.taxOffice ?? "",
        taxNumber: s.taxNumber ?? ""
      });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Ayarlar verisi yuklenemedi.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runBackup = async (modules: BackupModuleId[]) => {
    setScopeModal(null);
    setLoading(true);
    setMsg("");
    try {
      const path = await getMarinaApi().createBackup(modules);
      if (!path) {
        setMsg("Yedekleme iptal edildi.");
        return;
      }
      setMsg(`Yedek olusturuldu: ${path}`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Yedek olusturulamadi.");
    } finally {
      setLoading(false);
    }
  };

  const startRestoreByName = async (name: string) => {
    setMsg("");
    try {
      const inspect = await getMarinaApi().inspectBackupByName(name);
      setScopeModal({ mode: "restore", inspect, backupName: name });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Yedek okunamadi.");
    }
  };

  const startRestoreFromFile = async (file: File) => {
    setMsg("");
    try {
      const text = await file.text();
      const inspect = await getMarinaApi().inspectBackupFromJson(text);
      setScopeModal({ mode: "restore", inspect, jsonText: text });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Dosya okunamadi.");
    } finally {
      if (restoreFileRef.current) restoreFileRef.current.value = "";
    }
  };

  const runRestore = async (modules: BackupModuleId[]) => {
    if (scopeModal?.mode !== "restore") return;
    const { backupName, jsonText, inspect } = scopeModal;
    const label = backupName ?? (inspect.legacy ? "eski tam yedek dosyasi" : "secilen yedek dosyasi");
    if (
      !window.confirm(
        `Secili bolumler mevcut verinin uzerine yazilacak.\n\n${label}\n\nDevam edilsin mi?`
      )
    ) {
      return;
    }
    setScopeModal(null);
    setLoading(true);
    setMsg("");
    try {
      if (backupName) {
        await getMarinaApi().restoreBackup(backupName, modules);
      } else if (jsonText) {
        await getMarinaApi().restoreBackupFromJson(jsonText, modules);
      }
      setMsg("Yedek geri yuklendi. Sayfa yenileniyor...");
      window.setTimeout(() => window.location.reload(), 400);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Yedek geri yuklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    if (!window.confirm("Tum hata loglari temizlensin mi?")) return;
    await getMarinaApi().clearLogs();
    await load();
  };

  return (
    <motion.div className="settings-screen" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <h2>Ayarlar</h2>
      {msg && <p className="form-message">{msg}</p>}

      <p className="settings-account-hint muted small">
        Firma unvani ve fatura bilgileri icin ust menuden <strong>Hesap</strong> → <strong>Firma</strong> sekmesine gidin.
      </p>

      <section className="settings-card">
        <div className="settings-card-head">
          <h3>Yedekleme / Geri Yukleme</h3>
          <div className="settings-card-actions settings-backup-actions">
            <button type="button" disabled={loading} onClick={() => setScopeModal({ mode: "backup" })}>
              {loading ? "Isleniyor..." : "Yeni Yedek Al"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => restoreFileRef.current?.click()}
            >
              Yedekten Geri Yukle (Dosya)
            </button>
            <input
              ref={restoreFileRef}
              type="file"
              accept=".json,application/json"
              className="settings-file-input-hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void startRestoreFromFile(f);
              }}
            />
          </div>
        </div>
        <p className="settings-empty settings-backup-hint">
          Yedek alirken hangi bolumlerin kaydedilecegini secebilirsiniz (urunler, satislar, stok, kapanis, gelir-gider, ayarlar).
          Dosyada hangi bolumlerin oldugu etiketlenir; geri yuklerken yalnizca istediklerinizi uygularsiniz. Eski tam JSON yedekleri de
          desteklenir.
        </p>
        <div className="settings-backup-panel">
          <button
            type="button"
            className="settings-backup-toggle"
            aria-expanded={backupsOpen}
            aria-controls="settings-backup-list"
            onClick={() => setBackupsOpen((v) => !v)}
          >
            <span className="settings-backup-toggle-icon" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            Uygulama icindeki yedekler
            {backups.length > 0 ? ` (${backups.length})` : ""}
            <span className="settings-backup-toggle-chevron" aria-hidden="true">
              ▼
            </span>
          </button>
          {backupsOpen ? (
            <div id="settings-backup-list" className="settings-backup-panel-body">
              <div className="settings-list">
                {backups.length === 0 && (
                  <p className="settings-empty">
                    Henuz bu klasorde yedek yok. &quot;Yeni Yedek Al&quot; ile kaydedebilir veya onceki bir JSON yedegini dosyadan
                    yukleyebilirsiniz.
                  </p>
                )}
                {backups.map((b) => (
                  <div key={b.name} className="settings-row">
                    <div>
                      <strong>{b.name}</strong>
                      <small>
                        {fmtDate(b.createdAt)} · {fmtSize(b.size)}
                      </small>
                    </div>
                    <button type="button" disabled={loading} onClick={() => void startRestoreByName(b.name)}>
                      Geri Yukle
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <AppUpdateSection />

      <section className="settings-card">
        <div className="settings-card-head">
          <h3>Hata Loglari</h3>
          <div className="settings-card-actions">
            <button type="button" onClick={() => setLogsOpen(true)}>Loglari Ac</button>
            <button type="button" onClick={() => void clearLogs()}>Loglari Temizle</button>
          </div>
        </div>
        <p className="settings-empty">Loglari goruntulemek icin "Loglari Ac" butonunu kullanin.</p>
      </section>

      <FeedbackSection companyName={company.companyName} />

      {scopeModal?.mode === "backup" ? (
        <BackupScopeModal mode="backup" onConfirm={(m) => void runBackup(m)} onCancel={() => setScopeModal(null)} />
      ) : null}
      {scopeModal?.mode === "restore" ? (
        <BackupScopeModal
          mode="restore"
          inspect={scopeModal.inspect}
          onConfirm={(m) => void runRestore(m)}
          onCancel={() => setScopeModal(null)}
        />
      ) : null}
      {logsOpen && (
        <div className="settings-log-overlay" onClick={() => setLogsOpen(false)} role="dialog" aria-modal="true">
          <div className="settings-log-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="settings-card-head">
              <h3>Hata Loglari</h3>
              <button type="button" onClick={() => setLogsOpen(false)}>Kapat</button>
            </div>
            <div className="settings-list">
              {logs.length === 0 && <p className="settings-empty">Kayitli hata logu yok.</p>}
              {logs.map((l) => (
                <div key={l.id} className="settings-log-row">
                  <div className={`settings-log-badge ${l.level}`}>{l.level}</div>
                  <div>
                    <strong>{fmtDate(l.createdAt)}</strong>
                    <small>{l.message}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
