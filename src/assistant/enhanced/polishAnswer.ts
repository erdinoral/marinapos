import { bridgePolishText, isAssistantBridgeAvailable } from "./assistantBridge";
import { isEnhancedEnabled } from "./packStorage";

/** Cevabi main process modeli ile duzenler; hata olursa cekirdek metin kalir. */
export async function polishAnswerIfEnabled(question: string, coreAnswer: string): Promise<string> {
  if (!isEnhancedEnabled() || !isAssistantBridgeAvailable()) return coreAnswer;
  return bridgePolishText(question, coreAnswer);
}
