import { FAQ_ENTRIES, DEFAULT_SUGGESTIONS } from "./knowledgeBase";
import { LIVE_INTENTS, runProductStockHint } from "./liveIntents";
import { normalizeQuery, scoreKeywordHit } from "./normalizeQuery";
import type { AssistantReply, FaqEntry, PosAssistantConfig, PosAssistantDataPort } from "./types";

const MIN_LIVE_SCORE = 4;
const MIN_FAQ_SCORE = 3;

function pickBestFaq(normalized: string): { entry: FaqEntry; score: number } | null {
  let best: { entry: FaqEntry; score: number } | null = null;
  for (const entry of FAQ_ENTRIES) {
    const score = scoreKeywordHit(normalized, entry.keywords);
    if (!best || score > best.score) best = { entry, score };
  }
  if (!best || best.score < MIN_FAQ_SCORE) return null;
  return best;
}

function pickBestLive(normalized: string): { intent: (typeof LIVE_INTENTS)[0]; score: number } | null {
  let best: { intent: (typeof LIVE_INTENTS)[0]; score: number } | null = null;
  for (const intent of LIVE_INTENTS) {
    const score = scoreKeywordHit(normalized, intent.keywords);
    if (!best || score > best.score) best = { intent, score };
  }
  if (!best || best.score < MIN_LIVE_SCORE) return null;
  return best;
}

/** "cola stok" -> urun parcasi */
function extractProductQuery(normalized: string): string | null {
  const stripped = normalized
    .replace(/\b(stok|kac|kaldi|var mi|urun|ara|bak|goster)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length >= 2) return stripped;
  return null;
}

function fallbackReply(config: PosAssistantConfig): AssistantReply {
  return {
    source: "fallback",
    text:
      `Tam eslesme bulunamadi. Asagidaki hazir sorulardan birini deneyin veya anahtar kelime kullanin (stok, satis, borc, fifo, yedek).\n\n` +
      (config.labMode
        ? "Lab modu: cevaplar gercek veriden veya SSS metninden gelir; mock veya AI yok."
        : ""),
    suggestions: DEFAULT_SUGGESTIONS
  };
}

export async function askAssistant(
  question: string,
  port: PosAssistantDataPort,
  config: PosAssistantConfig
): Promise<AssistantReply> {
  const normalized = normalizeQuery(question);
  if (!normalized) return fallbackReply(config);

  const productQ = extractProductQuery(normalized);
  const looksLikeProduct =
    productQ &&
    productQ.length >= 2 &&
    (normalized.includes("stok") || normalized.includes("kaldi") || normalized.includes("urun"));

  if (looksLikeProduct && productQ) {
    try {
      const hint = await runProductStockHint(port, productQ);
      if (hint) {
        return {
          source: "live",
          intentId: "product-hint",
          fetchedAt: new Date().toISOString(),
          text: hint
        };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sorgu hatasi";
      return { source: "live", intentId: "product-hint", text: `Urun sorgusu basarisiz: ${msg}` };
    }
  }

  const live = pickBestLive(normalized);
  if (live && live.intent.id !== "product-hint") {
    try {
      const text = await live.intent.run(port);
      return {
        source: "live",
        intentId: live.intent.id,
        fetchedAt: new Date().toISOString(),
        text
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Veri okunamadi";
      return {
        source: "live",
        intentId: live.intent.id,
        text: `Canli veri alinamadi: ${msg}`,
        suggestions: DEFAULT_SUGGESTIONS
      };
    }
  }

  const faq = pickBestFaq(normalized);
  if (faq) {
    return {
      source: "faq",
      intentId: faq.entry.id,
      text: `${faq.entry.title}\n\n${faq.entry.body}`,
      suggestions: DEFAULT_SUGGESTIONS.filter((s) => normalizeQuery(s) !== normalized).slice(0, 4)
    };
  }

  return fallbackReply(config);
}

export { FAQ_ENTRIES, DEFAULT_SUGGESTIONS, LIVE_INTENTS };
