import { useEffect } from "react";

/** Windows/Electron: bazen klavye olaylari pencere odağı gelene kadar yazı alanlarına ulasmaz. */
export function useKeyboardFocusRecovery() {
  useEffect(() => {
    const nudge = () => {
      if (document.visibilityState !== "visible") return;
      window.focus();
    };
    window.addEventListener("focus", nudge);
    document.addEventListener("visibilitychange", nudge);
    return () => {
      window.removeEventListener("focus", nudge);
      document.removeEventListener("visibilitychange", nudge);
    };
  }, []);
}
