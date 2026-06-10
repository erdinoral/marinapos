import { app, BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";
import { githubReleasesPageUrl } from "../src/config/githubRelease";
import type { AppUpdateInfo } from "../src/types/models";
import type { ErrorLogService } from "../src/services/errorLogService";

let logs: ErrorLogService | null = null;
let state: AppUpdateInfo = {
  enabled: false,
  currentVersion: app.getVersion(),
  phase: "idle",
  releasePageUrl: githubReleasesPageUrl()
};

function setState(patch: Partial<AppUpdateInfo>) {
  state = { ...state, ...patch, currentVersion: app.getVersion(), releasePageUrl: githubReleasesPageUrl() };
  broadcast();
}

function broadcast() {
  const payload = getAppUpdateInfo();
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("app-update:state", payload);
    }
  }
}

function log(level: "info" | "warn" | "error", message: string) {
  logs?.add(level, message);
}

function isRetryableUpdateError(raw: string): boolean {
  const lower = raw.toLowerCase();
  return (
    lower.includes("504") ||
    lower.includes("gateway time-out") ||
    lower.includes("gateway timeout") ||
    lower.includes("etimedout") ||
    lower.includes("econnreset") ||
    lower.includes("socket hang up")
  );
}

/** electron-updater ham HTML/header ciktisini kullaniciya gostermeden Turkce ozet */
export function sanitizeUpdateError(raw: string): string {
  const msg = String(raw ?? "").trim();
  if (!msg) return "Guncelleme kontrol edilemedi.";

  const lower = msg.toLowerCase();
  if (lower.includes("504") || lower.includes("gateway time-out") || lower.includes("gateway timeout")) {
    return "GitHub sunucusu gecici olarak yanit vermedi (zaman asimi). Bir kac dakika sonra tekrar deneyin veya asagidaki Surumler sayfasindan guncellemeyi elle indirin.";
  }
  if (lower.includes("etimedout") || lower.includes("econnreset") || lower.includes("enotfound") || lower.includes("network")) {
    return "Internet baglantisi veya GitHub erisimi basarisiz. Baglantinizi kontrol edip tekrar deneyin.";
  }
  if (lower.includes("404") && (lower.includes("latest") || lower.includes("releases"))) {
    return "Guncelleme dosyasi bulunamadi. Release'de latest.yml ve Setup.exe yuklu mu kontrol edin.";
  }

  let clean = msg;
  for (const marker of ["\nHeaders:", "\nheaders:", "<!DOCTYPE", "<html", "<h1>504", "set-cookie:"]) {
    const idx = clean.toLowerCase().indexOf(marker.toLowerCase());
    if (idx >= 0) clean = clean.slice(0, idx);
  }
  clean = clean.replace(/\s+/g, " ").trim();
  if (clean.length > 220) clean = `${clean.slice(0, 217)}...`;
  return clean || "Guncelleme kontrol edilemedi.";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkForUpdatesWithRetry(maxAttempts = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    setState({ phase: "checking", error: undefined });
    try {
      await autoUpdater.checkForUpdates();
    } catch {
      // Hata cogu zaman "error" olayinda da yakalanir
    }
    await sleep(600);
    if (state.phase !== "error") return;
    const retryable =
      isRetryableUpdateError(state.error ?? "") || (state.error?.includes("zaman asimi") ?? false);
    if (!retryable || attempt >= maxAttempts) return;
    log("warn", `[app-update] Deneme ${attempt}/${maxAttempts} basarisiz, tekrar deneniyor...`);
    await sleep(2000 * attempt);
  }
}

export function getAppUpdateInfo(): AppUpdateInfo {
  return { ...state, currentVersion: app.getVersion() };
}

export function initAppUpdater(errorLogService: ErrorLogService): void {
  logs = errorLogService;
  if (!app.isPackaged) {
    setState({
      enabled: false,
      devMode: true,
      phase: "idle",
      error: undefined,
      latestVersion: undefined,
      releaseNotes: undefined
    });
    return;
  }

  setState({ enabled: true, devMode: false });
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on("checking-for-update", () => {
    setState({ phase: "checking", error: undefined });
    log("info", "[app-update] Guncelleme kontrol ediliyor...");
  });

  autoUpdater.on("update-available", (info) => {
    const notes =
      typeof info.releaseNotes === "string"
        ? info.releaseNotes
        : Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map((n) => (typeof n === "string" ? n : n.note ?? "")).join("\n")
          : "";
    setState({
      phase: "available",
      latestVersion: info.version,
      releaseNotes: notes.slice(0, 2000) || undefined,
      error: undefined,
      percent: undefined
    });
    log("info", `[app-update] Yeni surum: ${info.version}`);
  });

  autoUpdater.on("update-not-available", () => {
    setState({ phase: "not-available", latestVersion: undefined, releaseNotes: undefined, error: undefined });
    log("info", "[app-update] Guncel surum kullaniliyor.");
  });

  autoUpdater.on("error", (err) => {
    const raw = err instanceof Error ? err.message : String(err);
    const msg = sanitizeUpdateError(raw);
    setState({ phase: "error", error: msg });
    log("error", `[app-update] ${raw}`);
  });

  autoUpdater.on("download-progress", (p) => {
    setState({
      phase: "downloading",
      percent: p.percent,
      transferred: p.transferred,
      total: p.total,
      bytesPerSecond: p.bytesPerSecond
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    setState({
      phase: "downloaded",
      latestVersion: info.version,
      percent: 100,
      error: undefined
    });
    log("info", `[app-update] Indirme tamam: ${info.version}`);
  });
}

export async function checkForAppUpdate(): Promise<AppUpdateInfo> {
  if (!app.isPackaged) {
    setState({
      enabled: false,
      devMode: true,
      phase: "idle",
      error: "Guncelleme yalnizca kurulu uygulamada (Setup.exe) kullanilir."
    });
    return getAppUpdateInfo();
  }
  try {
    setState({ phase: "checking", error: undefined });
    await checkForUpdatesWithRetry();
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    setState({ phase: "error", error: sanitizeUpdateError(raw) });
    log("error", `[app-update] Kontrol: ${raw}`);
  }
  return getAppUpdateInfo();
}

export async function downloadAppUpdate(): Promise<AppUpdateInfo> {
  if (!app.isPackaged) return getAppUpdateInfo();
  if (state.phase !== "available" && state.phase !== "error") {
    return getAppUpdateInfo();
  }
  try {
    setState({ phase: "downloading", error: undefined, percent: 0 });
    await autoUpdater.downloadUpdate();
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    setState({ phase: "error", error: sanitizeUpdateError(raw) });
    log("error", `[app-update] Indirme: ${raw}`);
  }
  return getAppUpdateInfo();
}

export function installAppUpdate(): void {
  if (!app.isPackaged) return;
  if (state.phase !== "downloaded") return;
  log("info", "[app-update] Kurulum icin yeniden baslatiliyor...");
  autoUpdater.quitAndInstall(false, true);
}
