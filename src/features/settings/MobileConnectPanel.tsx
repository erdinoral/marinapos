import { useMobileConnect } from "./useMobileConnect";

type Props = {
  active?: boolean;
  compact?: boolean;
};

export function MobileConnectPanel({ active = true, compact = false }: Props) {
  const {
    status,
    qrDataUrl,
    apkQrDataUrl,
    busy,
    msg,
    connectionHint,
    apkHint,
    statusLabel,
    toggleEnabled,
    regenerate
  } = useMobileConnect(active);

  return (
    <div className={`mobile-connect-panel${compact ? " mobile-connect-panel-compact" : ""}`}>
      <div className="mobile-connect-beta-banner" role="status">
        <strong>Yakinda gelecektir</strong>
        <span>Mobil uygulama su an test asamasindadir. Canli kasada kullanmadan once deneme yapin.</span>
      </div>

      <div className="mobile-connect-howto">
        <h4>Nasil kullanilir?</h4>
        <ol className="mobile-connect-steps">
          <li>
            <strong>1. Uygulamayi kurun:</strong> Asagidan <strong>Baglantiyi ac</strong> deyin. Soldaki{" "}
            <strong>APK indir QR</strong> kodunu telefon kamerasi ile okutun → APK iner → kurun.
          </li>
          <li>
            <strong>2. PC&apos;ye baglanin:</strong> Marina POS Mobil uygulamasini acin → <strong>QR ile baglan</strong>{" "}
            → sagdaki <strong>baglanti QR</strong> kodunu okutun. Bir kez yeterli; sonraki acilislar otomatik baglanir.
          </li>
          <li>
            <strong>3. Kullanim:</strong> Telefon ve bu PC <strong>aynı Wi‑Fi</strong> aginda olmali. PC&apos;de Marina POS
            acik ve mobil sunucu acik kalmali. Mobilden satis, stok, urun ve musteri islemleri kasadaki veriye yazilir.
          </li>
          <li>
            <strong>4. Guncelleme:</strong> PC&apos;de <strong>Yeni baglanti QR</strong> uretirseniz telefonda tekrar okutun.
            APK guncellemesi icin yeni APK QR kullanilir.
          </li>
        </ol>
      </div>

      <div className="mobile-connect-actions">
        <button
          type="button"
          className={status?.enabled ? "" : "primary"}
          disabled={busy || !status}
          onClick={() => void toggleEnabled()}
        >
          {status?.enabled ? "Bağlantıyı kapat" : "Bağlantıyı aç"}
        </button>
        <button type="button" disabled={busy || !status?.enabled} onClick={() => void regenerate()}>
          Yeni bağlantı QR
        </button>
      </div>

      {msg ? <p className="form-message">{msg}</p> : null}

      <div className="settings-mobile-grid">
        <div className="settings-mobile-meta">
          <p>
            <strong>Durum:</strong> {statusLabel}
          </p>
          {status?.enabled && connectionHint ? (
            <p>
              <strong>Adres:</strong> <code>{connectionHint}</code>
            </p>
          ) : null}
          {status?.apkAvailable && apkHint ? (
            <p>
              <strong>Mobil APK:</strong> <code>{apkHint}</code>
            </p>
          ) : status?.enabled ? (
            <p className="muted small">
              APK henüz yok. <code>marina-pos-mobile.apk</code> dosyasını{" "}
              <code>%APPDATA%\Marina Nargile POS\data\mobile\</code> klasörüne koyun, PC&apos;yi yeniden açın. (Setup
              artık APK içermez.)
            </p>
          ) : null}
          {status?.enabled ? (
            <p className="muted small">
              Bağlantı anahtarı: <code>{status.tokenMasked}</code> (tam anahtar sağ QR içinde)
            </p>
          ) : null}
          <ul className="settings-mobile-notes muted small">
            <li>PC açık ve Marina POS çalışırken kullanın.</li>
            <li>Windows güvenlik duvarı izin sorarsa onaylayın.</li>
            <li>Test surumudur; veri kaybi riskine karsi onemli islemleri PC&apos;den dogrulayin.</li>
          </ul>
        </div>

        {status?.enabled ? (
          <div className="settings-mobile-qr-row">
            <div className="settings-mobile-qr-wrap">
              {apkQrDataUrl ? (
                <>
                  <img
                    src={apkQrDataUrl}
                    alt="Mobil APK indirme QR kodu"
                    className="settings-mobile-qr"
                    width={220}
                    height={220}
                  />
                  <p className="muted small">
                    <strong>1 — APK indir</strong>
                    <br />
                    Kamera ile okut
                  </p>
                </>
              ) : (
                <div className="settings-mobile-qr-placeholder muted small">
                  APK QR yok
                  <br />
                  build/mobile/ içine .apk koyun
                </div>
              )}
            </div>
            <div className="settings-mobile-qr-wrap">
              {qrDataUrl ? (
                <>
                  <img
                    src={qrDataUrl}
                    alt="Mobil bağlantı QR kodu"
                    className="settings-mobile-qr"
                    width={220}
                    height={220}
                  />
                  <p className="muted small">
                    <strong>2 — Uygulamaya baglan</strong>
                    <br />
                    Marina POS Mobil içinden okut
                  </p>
                </>
              ) : (
                <div className="settings-mobile-qr-placeholder muted small">Bağlantı QR yükleniyor…</div>
              )}
            </div>
          </div>
        ) : (
          <div className="settings-mobile-qr-placeholder muted small">
            {status === null ? "Kurulu uygulamada kullanılabilir." : 'Önce "Bağlantıyı aç" deyin.'}
          </div>
        )}
      </div>
    </div>
  );
}
