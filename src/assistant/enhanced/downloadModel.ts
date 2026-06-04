import { setPackReady } from "./packStorage";
import { bridgeDownloadModel, isAssistantBridgeAvailable } from "./assistantBridge";

export type ModelDownloadProgress = {
  status: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
};

/** Model indirme — Electron main process (onnxruntime-node), renderer degil. */
export async function downloadAndWarmModel(onProgress: (p: ModelDownloadProgress) => void): Promise<void> {
  if (!isAssistantBridgeAvailable()) {
    throw new Error("Gelismis asistan icin uygulamayi Electron ile acin.");
  }
  await bridgeDownloadModel(onProgress);
  setPackReady(true);
}

export function resetModelCache(): void {
  setPackReady(false);
}
