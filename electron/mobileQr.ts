import QRCode from "qrcode";
import type { MobileLanServer } from "./localApiServer";

export async function mobileLanQrDataUrl(server: MobileLanServer): Promise<string> {
  const status = server.getStatus();
  if (!status.enabled) return "";
  const payload = server.getPairPayload();
  return QRCode.toDataURL(JSON.stringify(payload), {
    margin: 2,
    width: 260,
    errorCorrectionLevel: "M"
  });
}

export async function mobileApkQrDataUrl(server: MobileLanServer): Promise<string> {
  const status = server.getStatus();
  if (!status.enabled || !status.apkAvailable) return "";
  const info = server.getApkInfo();
  return QRCode.toDataURL(info.installPageUrl, {
    margin: 2,
    width: 260,
    errorCorrectionLevel: "M"
  });
}
