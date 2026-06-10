import { useEffect, useMemo, useState } from "react";
import { getMarinaApi } from "../../api/marinaClient";
import {
  BACKUP_MODULE_IDS,
  BACKUP_MODULE_LABELS,
  formatBackupModuleCount,
  type BackupModuleId,
  type BackupModuleSelection,
  type BackupModuleStats,
  type BackupInspectResult,
  emptyModuleSelection,
  selectedModuleIds
} from "../../types/backup";

type Mode = "backup" | "restore";

type Props = {
  mode: Mode;
  inspect?: BackupInspectResult | null;
  onConfirm: (modules: BackupModuleId[]) => void;
  onCancel: () => void;
};

function fmtDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
}

export function BackupScopeModal({ mode, inspect, onConfirm, onCancel }: Props) {
  const [sel, setSel] = useState<BackupModuleSelection>(() => emptyModuleSelection(mode === "backup"));
  const [stats, setStats] = useState<BackupModuleStats | null>(null);

  useEffect(() => {
    if (mode !== "backup") {
      setStats(null);
      return;
    }
    const api = getMarinaApi();
    if (typeof api.getBackupModuleStats !== "function") return;
    void api
      .getBackupModuleStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, [mode]);

  const enabledIds = useMemo(() => {
    if (mode === "backup") return BACKUP_MODULE_IDS;
    if (!inspect) return [] as BackupModuleId[];
    return BACKUP_MODULE_IDS.filter((id) => inspect.available[id]);
  }, [mode, inspect]);

  useEffect(() => {
    if (mode === "backup") {
      setSel(emptyModuleSelection(true));
      return;
    }
    if (!inspect) return;
    const next = emptyModuleSelection(false);
    for (const id of BACKUP_MODULE_IDS) {
      next[id] = inspect.available[id];
    }
    setSel(next);
  }, [mode, inspect]);

  const allOn = enabledIds.length > 0 && enabledIds.every((id) => sel[id]);
  const noneOn = selectedModuleIds(sel).length === 0;
  const createdLabel = inspect?.legacy ? "Eski tam yedek (tum bolumler)" : fmtDate(inspect?.createdAt ?? null);

  const toggleAll = (on: boolean) => {
    setSel((prev) => {
      const next = { ...prev };
      for (const id of enabledIds) next[id] = on;
      return next;
    });
  };

  const toggle = (id: BackupModuleId) => {
    if (!enabledIds.includes(id)) return;
    setSel((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="settings-log-overlay backup-scope-overlay" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="settings-log-dialog backup-scope-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="settings-card-head">
          <h3>{mode === "backup" ? "Neleri yedeklemek istersiniz?" : "Neleri geri yuklemek istersiniz?"}</h3>
          <button type="button" onClick={onCancel}>
            Kapat
          </button>
        </div>
        {mode === "restore" && inspect ? (
          <p className="backup-scope-meta muted small">
            {createdLabel ? <>Yedek tarihi: <strong>{createdLabel}</strong>. </> : null}
            Dosyada bulunan bolumler isaretli; sadece secili olanlar mevcut verinin uzerine yazilir.
          </p>
        ) : (
          <p className="backup-scope-meta muted small">
            Secili bolumler tek JSON dosyasinda ayri etiketlerle kaydedilir.{" "}
            <strong>Satislar ve satis gecmisi</strong> tum fisleri (sepet adlari, musterili/musterisiz, iade, borc odemesi)
            icerir. Eski tam yedekler de geri yuklenebilir.
          </p>
        )}
        <label className="backup-scope-select-all">
          <input type="checkbox" checked={allOn} onChange={(e) => toggleAll(e.target.checked)} />
          <span>Tumunu sec</span>
        </label>
        <ul className="backup-scope-list">
          {BACKUP_MODULE_IDS.map((id) => {
            const disabled = mode === "restore" && !enabledIds.includes(id);
            const meta = BACKUP_MODULE_LABELS[id];
            return (
              <li key={id} className={disabled ? "is-disabled" : undefined}>
                <label>
                  <input type="checkbox" checked={sel[id]} disabled={disabled} onChange={() => toggle(id)} />
                  <span className="backup-scope-item-title">{meta.title}</span>
                  <span className="backup-scope-item-desc muted small">
                    {meta.description}
                    {mode === "backup" && stats ? (
                      <>
                        {" "}
                        · <strong>{formatBackupModuleCount(id, stats[id])}</strong>
                      </>
                    ) : null}
                  </span>
                  {disabled ? <span className="backup-scope-missing muted small">Bu yedekte yok</span> : null}
                </label>
              </li>
            );
          })}
        </ul>
        <div className="backup-scope-actions">
          <button type="button" onClick={onCancel}>
            Iptal
          </button>
          <button
            type="button"
            className="backup-scope-confirm"
            disabled={noneOn}
            onClick={() => onConfirm(selectedModuleIds(sel))}
          >
            {mode === "backup" ? "Yedekle" : "Geri yukle"}
          </button>
        </div>
      </div>
    </div>
  );
}
