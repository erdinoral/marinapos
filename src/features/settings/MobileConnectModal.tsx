import { MobileConnectPanel } from "./MobileConnectPanel";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function MobileConnectModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="mobile-connect-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="mobile-connect-title">
      <div className="mobile-connect-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-connect-dialog-head">
          <div>
            <h2 id="mobile-connect-title">Telefon bağlantısı</h2>
            <p className="muted small">Yerel ağ · test aşamasında · yakında</p>
          </div>
          <button type="button" className="mobile-connect-close" onClick={onClose} aria-label="Kapat">
            ✕
          </button>
        </div>
        <MobileConnectPanel active={open} compact />
      </div>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg className="topbar-mobile-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v16h10V4H7zm5 15a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5z"
      />
    </svg>
  );
}

export function TopbarMobileButton({ onClick, active }: { onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      className={`topbar-mobile-btn${active ? " active" : ""}`}
      onClick={onClick}
      title="Telefon bağlantısı"
      aria-label="Telefon bağlantısı ve QR kod"
    >
      <PhoneIcon />
    </button>
  );
}
