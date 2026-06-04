import { useCallback, useMemo, useRef, useState } from "react";
import { askAssistant, DEFAULT_SUGGESTIONS } from "../engine";
import type { AssistantMessage, PosAssistantConfig, PosAssistantDataPort } from "../types";

type Props = {
  dataPort: PosAssistantDataPort;
  config: PosAssistantConfig;
};

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AssistantLab({ dataPort, config }: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>(() => [
    {
      id: "welcome",
      role: "assistant",
      at: new Date().toISOString(),
      source: "faq",
      text:
        `${config.displayName} asistan deneme alani.\n\n` +
        "• SSS: is akisi metinleri (stok, FIFO, borc…)\n" +
        "• Canli: bugunun satisi, eksik stok, borc ozetleri\n" +
        "• Mock / bulut AI yok — entegrasyon testi icin tasarlandi.\n\n" +
        "Hazir sorulardan birine tiklayin veya asagiya yazin."
    }
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const configLabel = useMemo(() => {
    const parts = [config.displayName];
    if (config.labMode) parts.push("LAB");
    if (config.version) parts.push(`v${config.version}`);
    return parts.join(" · ");
  }, [config]);

  const submit = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      setBusy(true);
      setInput("");
      const userMsg: AssistantMessage = {
        id: newId(),
        role: "user",
        text: q,
        at: new Date().toISOString()
      };
      setMessages((prev) => [...prev, userMsg]);
      try {
        const reply = await askAssistant(q, dataPort, config);
        const assistantMsg: AssistantMessage = {
          id: newId(),
          role: "assistant",
          text: reply.text,
          source: reply.source,
          intentId: reply.intentId,
          at: reply.fetchedAt ?? new Date().toISOString()
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
        setMessages((prev) => [
          ...prev,
          { id: newId(), role: "assistant", text: `Hata: ${msg}`, at: new Date().toISOString() }
        ]);
      } finally {
        setBusy(false);
        requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
      }
    },
    [busy, config, dataPort]
  );

  return (
    <div className="assistant-lab">
      <header className="assistant-lab-header">
        <div>
          <h2>POS Asistan</h2>
          <p className="muted small">{configLabel}</p>
        </div>
        <span className="assistant-lab-badge">Entegrasyon testi</span>
      </header>

      <div className="assistant-lab-chips" aria-label="Hazir sorular">
        {DEFAULT_SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="assistant-chip" disabled={busy} onClick={() => void submit(s)}>
            {s}
          </button>
        ))}
      </div>

      <div className="assistant-lab-thread" ref={scrollRef} role="log" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`assistant-bubble assistant-bubble--${m.role}`}>
            <div className="assistant-bubble-meta">
              {m.role === "user" ? "Siz" : "Asistan"}
              {m.source && m.role === "assistant" ? (
                <span className="assistant-source-tag">
                  {m.source === "live" ? "canli veri" : m.source === "faq" ? "SSS" : "—"}
                </span>
              ) : null}
            </div>
            <pre className="assistant-bubble-text">{m.text}</pre>
          </div>
        ))}
        {busy && <p className="assistant-typing muted small">Sorgulaniyor…</p>}
      </div>

      <form
        className="assistant-lab-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(input);
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ornek: bugun kac satis, eksik stok, cola stok"
          disabled={busy}
          autoComplete="off"
        />
        <button type="submit" disabled={busy || !input.trim()}>
          Gonder
        </button>
      </form>

      <p className="assistant-lab-foot muted small">
        Tasima: <code>src/assistant</code> klasorunu kendi POS&apos;a kopyalayin; yalnizca{" "}
        <code>PosAssistantDataPort</code> adaptoru ve istege bagli UI baglayin.
      </p>
    </div>
  );
}
