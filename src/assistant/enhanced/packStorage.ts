const PACK_KEY = "marina_assistant_pack";
const ENHANCED_KEY = "marina_assistant_enhanced_on";

export type AssistantPackState = "none" | "ready";

export function getPackState(): AssistantPackState {
  try {
    return localStorage.getItem(PACK_KEY) === "ready" ? "ready" : "none";
  } catch {
    return "none";
  }
}

export function setPackReady(ready: boolean): void {
  try {
    if (ready) localStorage.setItem(PACK_KEY, "ready");
    else localStorage.removeItem(PACK_KEY);
  } catch {
    /* ignore */
  }
}

export function isEnhancedEnabled(): boolean {
  try {
    return localStorage.getItem(ENHANCED_KEY) === "1" && getPackState() === "ready";
  } catch {
    return false;
  }
}

export function setEnhancedEnabled(on: boolean): void {
  try {
    if (on && getPackState() === "ready") localStorage.setItem(ENHANCED_KEY, "1");
    else localStorage.removeItem(ENHANCED_KEY);
  } catch {
    /* ignore */
  }
}
