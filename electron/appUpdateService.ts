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
    const msg = err instanceof Error ? err.message : String(err);
    setState({ phase: "error", error: msg });
    log("error", `[app-update] ${msg}`);
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
    await autoUpdater.checkForUpdates();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    setState({ phase: "error", error: msg });
    log("error", `[app-update] Kontrol: ${msg}`);
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
    const msg = e instanceof Error ? e.message : String(e);
    setState({ phase: "error", error: msg });
    log("error", `[app-update] Indirme: ${msg}`);
  }
  return getAppUpdateInfo();
}

export function installAppUpdate(): void {
  if (!app.isPackaged) return;
  if (state.phase !== "downloaded") return;
  log("info", "[app-update] Kurulum icin yeniden baslatiliyor...");
  autoUpdater.quitAndInstall(false, true);
}
