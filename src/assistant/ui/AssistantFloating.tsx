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
        {open && (
          <motion.div
            className="assistant-float-panel"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.2 }}
          >
            <div className="assistant-float-header">
              <div className="assistant-float-title-wrap">
                <strong>{config.displayName}</strong>
                <span className="assistant-float-subtitle">Test asamasinda, gelistirme devam ediyor.</span>
              </div>
              <button type="button" className="assistant-float-close" onClick={() => setOpen(false)} aria-label="Kapat">
                ×
              </button>
            </div>
            <AssistantChat
              dataPort={dataPort}
              config={config}
              compact
            />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        className="assistant-fab"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Asistani kapat" : "Asistani ac"}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
      >
        {open ? (
          <span className="assistant-fab-close" aria-hidden>
            ×
          </span>
        ) : (
          <img src={assistantIconSrc} alt="" className="assistant-fab-icon" />
        )}
      </motion.button>

    </>
  );
}
