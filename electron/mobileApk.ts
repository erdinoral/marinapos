import fs from "node:fs";
import http from "node:http";
import path from "node:path";

export const MOBILE_APK_FILENAME = "marina-pos-mobile.apk";

export type MobileApkInfo = {
  available: boolean;
  filename: string;
  sizeBytes: number;
  versionLabel: string;
  downloadUrl: string;
  installPageUrl: string;
};

function apkCandidates(dataDir: string): string[] {
  const roots = [
    path.join(dataDir, "mobile"),
    process.resourcesPath ? path.join(process.resourcesPath, "mobile") : "",
    path.join(process.cwd(), "build", "mobile"),
    path.join(process.cwd(), "data", "mobile")
  ].filter((dir) => Boolean(dir));
  const names = [MOBILE_APK_FILENAME, "app-release.apk", "app-preview.apk"];
  const out: string[] = [];
  for (const dir of roots) {
    for (const name of names) {
      out.push(path.join(dir, name));
    }
    try {
      if (fs.existsSync(dir)) {
        for (const entry of fs.readdirSync(dir)) {
          if (entry.toLowerCase().endsWith(".apk")) {
            out.push(path.join(dir, entry));
          }
        }
      }
    } catch {
      /* */
    }
  }
  return out;
}

export function resolveMobileApkPath(dataDir: string): string | null {
  for (const candidate of apkCandidates(dataDir)) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      /* */
    }
  }
  return null;
}

export function getMobileApkInfo(dataDir: string, host: string, port: number): MobileApkInfo {
  const base = `http://${host}:${port}`;
  const downloadUrl = `${base}/api/mobile/apk`;
  const installPageUrl = `${base}/api/mobile/install`;
  const file = resolveMobileApkPath(dataDir);
  if (!file) {
    return {
      available: false,
      filename: MOBILE_APK_FILENAME,
      sizeBytes: 0,
      versionLabel: "",
      downloadUrl,
      installPageUrl
    };
  }
  const stat = fs.statSync(file);
  return {
    available: true,
    filename: path.basename(file),
    sizeBytes: stat.size,
    versionLabel: path.basename(file, ".apk"),
    downloadUrl,
    installPageUrl
  };
}

export function serveMobileApkMissingPage(res: http.ServerResponse): void {
  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>APK yok</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #14110c; color: #f5eed9; margin: 0; padding: 24px; }
    .card { max-width: 420px; margin: 0 auto; background: #1f1a12; border: 1px solid #3a3224; border-radius: 14px; padding: 20px; }
    h1 { color: #d4af55; font-size: 20px; margin: 0 0 8px; }
    p { line-height: 1.5; color: #a89870; }
  </style>
</head>
<body>
  <div class="card">
    <h1>APK bulunamadi</h1>
    <p>PC'de mobil APK yok. Dosyayi su klasore koyun (yoksa olusturun), sonra Marina POS'u yeniden acin:</p>
    <p><code>%APPDATA%\\Marina Nargile POS\\data\\mobile\\marina-pos-mobile.apk</code></p>
  </div>
</body>
</html>`;
  res.writeHead(404, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(html);
}

export function serveMobileApkInstallPage(res: http.ServerResponse, info: MobileApkInfo): void {
  const mb = Math.max(1, Math.round(info.sizeBytes / (1024 * 1024)));
  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="color-scheme" content="dark" />
  <title>Marina POS Mobil — Indir</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #14110c; color: #f5eed9; margin: 0; padding: 24px; }
    .card { max-width: 420px; margin: 0 auto; background: #1f1a12; border: 1px solid #3a3224; border-radius: 14px; padding: 20px; }
    h1 { color: #d4af55; font-size: 22px; margin: 0 0 8px; }
    p { line-height: 1.5; color: #a89870; }
    a.btn {
      display: block; margin-top: 18px; background: #d4af55; color: #1a1408;
      text-align: center; padding: 16px; border-radius: 12px; font-weight: 800;
      text-decoration: none; font-size: 17px;
    }
    .muted { font-size: 13px; margin-top: 14px; }
    code { color: #e8d5a8; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Marina POS Mobil</h1>
    <p>Asagidaki dugmeye dokunarak APK'yi indirin (~${mb} MB). Indirdikten sonra dosyayi acip kurun.</p>
    <a class="btn" id="dl" href="${info.downloadUrl}" download="${info.filename}">APK indir (~${mb} MB)</a>
    <p class="muted">Indirme baslamazsa dugmeye tekrar dokunun. Android &quot;bilinmeyen uygulamalar&quot; iznini acmaniz gerekebilir.</p>
    <p class="muted">Dogrudan link: <code>${info.downloadUrl}</code></p>
  </div>
  <script>
    (function () {
      var url = ${JSON.stringify(info.downloadUrl)};
      // Otomatik yonlendirme: bazi tarayicilar engeller; dugme asil yol
      var a = document.getElementById("dl");
      if (a) {
        setTimeout(function () {
          try { a.click(); } catch (e) {}
        }, 400);
      } else {
        setTimeout(function () { location.href = url; }, 500);
      }
    })();
  </script>
</body>
</html>`;
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(html);
}

export function serveMobileApkFile(res: http.ServerResponse, filePath: string): void {
  const stat = fs.statSync(filePath);
  const filename = path.basename(filePath);
  res.writeHead(200, {
    "Content-Type": "application/vnd.android.package-archive",
    "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Content-Length": stat.size,
    "Cache-Control": "no-store",
    "Accept-Ranges": "bytes",
    "Access-Control-Allow-Origin": "*",
    "X-Content-Type-Options": "nosniff"
  });
  fs.createReadStream(filePath).pipe(res);
}
