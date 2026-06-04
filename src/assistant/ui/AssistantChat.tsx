import { useCallback, useMemo, useRef, useState } from "react";
import { askAssistant, DEFAULT_SUGGESTIONS } from "../engine";
import type { AssistantMessage, PosAssistantConfig, PosAssistantDataPort } from "../types";

type Props = {
  dataPort: PosAssistantDataPort;
  config: PosAssistantConfig;
  compact?: boolean;
};

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const SUGGESTION_GROUPS = [
  { title: "Canli", items: ["Bugun kac satis?", "Eksik stoklar", "Musteri borcu", "Tedarikci borcu"] },
  { title: "Rehber", items: ["Stok nasil eklenir?", "FIFO nedir?", "Gramajli urun mantigi", "Yedekleme nasil yapilir?"] }
];

function nextSuggestions(seed: number): string[] {
  const pool = [...new Set([...DEFAULT_SUGGESTIONS, ...SUGGESTION_GROUPS.flatMap((g) => g.items)])];
  const sorted = [...pool].sort((a, b) => {
    const aScore = (a.length * 13 + seed * 7 + a.charCodeAt(0)) % 97;
    const bScore = (b.length * 13 + seed * 7 + b.charCodeAt(0)) % 97;
    return aScore - bScore;
  });
  return sorted.slice(0, 8);
}

export function AssistantChat({ dataPort, config, compact }: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestionSeed, setSuggestionSeed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const welcomeText = useMemo(
    () =>
      "Merhaba, ben Aki Asistan.\n\n" +
      "Akiyom tarafindan gelistirilen ve size yardimci olmak icin uretilen yardimcinizim.\n\n" +
      "Su an test asamasindayiz; yukaridaki hazir kutulara tiklayarak hizlica yardim alabilirsiniz.\n\n" +
      "Isterseniz kendi sorunuzu da yazarak devam edebilirsiniz.",
    []
  );
  const chipSuggestions = useMemo(() => nextSuggestions(suggestionSeed), [suggestionSeed]);

  const [messages, setMessages] = useState<AssistantMessage[]>(() => [
    {
      id: "welcome",
      role: "assistant",
      at: new Date().toISOString(),
      source: "faq",
      text: welcomeText
    }
  ]);

  const scrollToEnd = () => {
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
  };

  const submit = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      setBusy(true);
      setInput("");
      setMessages((prev) => [...prev, { id: newId(), role: "user", text: q, at: new Date().toISOString() }]);
      try {
        const reply = await askAssistant(q, dataPort, config);
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            text: reply.text,
            source: reply.source,
            intentId: reply.intentId,
            at: reply.fetchedAt ?? new Date().toISOString()
          }
        ]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
        setMessages((prev) => [
          ...prev,
          { id: newId(), role: "assistant", text: `Hata: ${msg}`, at: new Date().toISOString() }
        ]);
      } finally {
        setBusy(false);
        scrollToEnd();
      }
    },
    [busy, config, dataPort]
  );

  return (
    <div className={`assistant-chat ${compact ? "assistant-chat--compact" : ""}`}>
      <div className="assistant-options-head">
        <span className="assistant-options-title">Hazir secenekler</span>
        <button
          type="button"
          className="assistant-options-refresh"
          onClick={() => setSuggestionSeed((s) => s + 1)}
          disabled={busy}
          title="Farkli secenekler getir"
        >
          Yenile
        </button>
      </div>

      <div className="assistant-lab-chips" aria-label="Hazir sorular">
        {chipSuggestions.map((s) => (
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
                  {m.source === "live" ? "canli veri" : m.source === "faq" ? "rehber" : "—"}
                </span>
              ) : null}
            </div>
            <pre className="assistant-bubble-text">{m.text}</pre>
          </div>
        ))}
        {busy && <p className="assistant-typing muted small">Yanitlaniyor…</p>}
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
          placeholder="Ornek: bugun kac satis, eksik stok"
          disabled={busy}
          autoComplete="off"
        />
        <button type="submit" disabled={busy || !input.trim()}>
          Gonder
        </button>
      </form>
    </div>
  );
}
