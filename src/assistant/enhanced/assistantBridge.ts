import type { ModelDownloadProgress } from "./downloadModel";

function getApi(): Window["marinaApi"] | null {
  if (typeof window === "undefined") return null;
  return window.marinaApi ?? null;
}

export function isAssistantBridgeAvailable(): boolean {
  const api = getApi();
  return typeof api?.downloadAssistantModel === "function";
}

export async function bridgeDownloadModel(onProgress: (p: ModelDownloadProgress) => void): Promise<void> {
  const api = getApi();
  if (!api?.downloadAssistantModel) {
    throw new Error("Gelismis asistan yalnizca Electron uygulamasinda calisir (npm run dev veya kurulum).");
  }

  const unsub = api.onAssistantDownloadProgress?.((p) => onProgress(p as ModelDownloadProgress));
  try {
    const res = await api.downloadAssistantModel();
    if (res && typeof res === "object" && "ok" in res && !(res as { ok: boolean }).ok) {
      const err = (res as { error?: string }).error;
      throw new Error(err || "Model indirilemedi.");
    }
  } finally {
    unsub?.();
  }
}

export async function bridgePolishText(question: string, coreAnswer: string): Promise<string> {
  const api = getApi();
  if (!api?.polishAssistantAnswer) return coreAnswer;
  try {
    const text = await api.polishAssistantAnswer(question, coreAnswer);
    return typeof text === "string" && text.trim() ? text : coreAnswer;
  } catch {
    return coreAnswer;
  }
}
