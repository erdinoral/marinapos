import { useCallback, useState } from "react";
import {
  ASSISTANT_PACK_DESCRIPTION,
  ASSISTANT_PACK_LABEL
} from "../config/modelPack";
import { downloadAndWarmModel, type ModelDownloadProgress } from "../enhanced/downloadModel";
import { setEnhancedEnabled } from "../enhanced/packStorage";

type Props = {
  open: boolean;
  onClose: () => void;
  onReady: () => void;
};

function formatMb(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ModelDownloadModal({ open, onClose, onReady }: Props) {
  const [phase, setPhase] = useState<"confirm" | "downloading" | "done" | "error">("confirm");
  const [progress, setProgress] = useState<ModelDownloadProgress | null>(null);
  const [error, setError] = useState("");

  const startDownload = useCallback(async () => {
    setPhase("downloading");
    setError("");
    setProgress({ status: "init", progress: 0 });
    try {
      await downloadAndWarmModel((p) => setProgress(p));
      setEnhancedEnabled(true);
      setPhase("done");
      onReady();
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : "Indirme basarisiz.");
    }
  }, [onReady]);

  const handleClose = () => {
    if (phase === "downloading") return;
    setPhase("confirm");
    setProgress(null);
    setError("");
    onClose();
  };

  if (!open) return null;

  const pct =
    progress?.progress != null && Number.isFinite(progress.progress)
      ? Math.round(progress.progress * 100)
      : progress?.status === "done"
        ? 100
        : null;

  return (
    <div className="assistant-dl-overlay" onClick={handleClose} role="dialog" aria-modal="true">
      <div className="assistant-dl-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Gelismis yanitlar</h3>

        {phase === "confirm" && (
          <>
            <p className="assistant-dl-lead">
              Yaklasik <strong>{ASSISTANT_PACK_LABEL}</strong> veri indirilecek. Ayri program kurmaniza gerek yok; tek tikla
              bu uygulama icinde tamamlanir.
            </p>
            <p className="muted small">{ASSISTANT_PACK_DESCRIPTION}</p>
            <div className="assistant-dl-actions">
              <button type="button" className="assistant-dl-primary" onClick={() => void startDownload()}>
                Indir ve kur
              </button>
              <button type="button" onClick={handleClose}>
                Simdi degil
              </button>
            </div>
          </>
        )}

        {phase === "downloading" && (
          <>
            <p className="muted small">Indiriliyor… Lutfen pencereyi kapatmayin.</p>
            {progress?.file && <p className="assistant-dl-file small">{progress.file}</p>}
            <div className="assistant-dl-bar" aria-valuenow={pct ?? 0} aria-valuemin={0} aria-valuemax={100}>
              <div className="assistant-dl-bar-fill" style={{ width: `${pct ?? 8}%` }} />
            </div>
            <p className="small muted">
              {pct != null ? `%${pct}` : progress?.status ?? "Hazirlaniyor"}
              {progress?.loaded && progress?.total
                ? ` · ${formatMb(progress.loaded)} / ${formatMb(progress.total)}`
                : ""}
            </p>
          </>
        )}

        {phase === "done" && (
          <>
            <p className="assistant-dl-ok">Kurulum tamam. Gelismis yanitlar acik.</p>
            <div className="assistant-dl-actions">
              <button type="button" className="assistant-dl-primary" onClick={handleClose}>
                Tamam
              </button>
            </div>
          </>
        )}

        {phase === "error" && (
          <>
            <p className="assistant-dl-error">{error}</p>
            <div className="assistant-dl-actions">
              <button type="button" className="assistant-dl-primary" onClick={() => void startDownload()}>
                Tekrar dene
              </button>
              <button type="button" onClick={handleClose}>
                Kapat
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
