import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createMarinaAssistantDataPort } from "../adapters/marinaDataPort";
import type { PosAssistantConfig } from "../types";
import assistantIconSrc from "../../assets/assistant-icon.png";
import { AssistantChat } from "./AssistantChat";

type Props = {
  config: PosAssistantConfig;
};

export function AssistantFloating({ config }: Props) {
  const [open, setOpen] = useState(false);
  const dataPort = useMemo(() => createMarinaAssistantDataPort(), []);

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.button
            type="button"
            className="assistant-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            aria-label="Asistani kapat"
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {open ? (
          <motion.aside
            className="assistant-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            aria-label="AI Asistan paneli"
          >
            <header className="assistant-drawer-header">
              <div className="assistant-drawer-title-wrap">
                <img src={assistantIconSrc} alt="" className="assistant-drawer-icon" />
                <div>
                  <strong>AI Asistan</strong>
                  <span className="assistant-drawer-subtitle">{config.displayName} · test asamasinda</span>
                </div>
              </div>
              <button type="button" className="assistant-drawer-close" onClick={() => setOpen(false)} aria-label="Kapat">
                ×
              </button>
            </header>
            <AssistantChat dataPort={dataPort} config={config} compact />
          </motion.aside>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        className={`assistant-rail-trigger${open ? " assistant-rail-trigger--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "AI Asistani kapat" : "AI Asistani ac"}
        whileHover={{ x: -2 }}
        whileTap={{ scale: 0.98 }}
      >
        <span className="assistant-rail-burger" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="assistant-rail-label">AI Asistan</span>
      </motion.button>
    </>
  );
}
