import { MobileConnectPanel } from "./MobileConnectPanel";

export function MobileConnectSection() {
  return (
    <section className="settings-card settings-mobile-card">
      <div className="settings-card-head">
        <h3>Mobil uygulama (yerel ağ)</h3>
        <p className="muted small settings-mobile-hint">Yakında · şu an test aşamasında</p>
      </div>
      <MobileConnectPanel active />
    </section>
  );
}
