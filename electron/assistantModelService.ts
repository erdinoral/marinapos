import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { ASSISTANT_MODEL_ID } from "../src/config/assistantModel";
import { loadEnvLocal } from "./loadEnvLocal";

export type AssistantModelProgress = {
  status: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
};

type Text2TextPipeline = (
  input: string,
  options?: { max_new_tokens?: number }
) => Promise<{ generated_text: string }[]>;

let pipelineInstance: Text2TextPipeline | null = null;
let pipelinePromise: Promise<Text2TextPipeline> | null = null;
let modelReady = false;

function cacheDir(): string {
  return path.join(app.getPath("userData"), "assistant-model-cache");
}

function ensureEnvLoaded(): void {
  loadEnvLocal([process.cwd(), app.getAppPath(), path.dirname(app.getPath("exe"))]);
}

function wrapLoadError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("Unauthorized") || msg.includes("401")) {
    return new Error(
      "Model dosyasina erisilemedi (Hugging Face). Interneti kontrol edin; " +
        "gerekirse proje klasorundeki .env.local dosyasina HF_TOKEN=... ekleyin " +
        "(huggingface.co Settings → Access Tokens)."
    );
  }
  return e instanceof Error ? e : new Error(msg);
}

async function loadPipeline(onProgress?: (p: AssistantModelProgress) => void): Promise<Text2TextPipeline> {
  if (pipelineInstance) return pipelineInstance;
  if (pipelinePromise) return pipelinePromise;

  pipelinePromise = (async () => {
    ensureEnvLoaded();
    const dir = cacheDir();
    fs.mkdirSync(dir, { recursive: true });

    try {
      const { pipeline, env } = await import("@xenova/transformers");
      env.cacheDir = dir;
      env.allowRemoteModels = true;
      env.useBrowserCache = false;
      env.useFSCache = true;

      const pipe = (await pipeline("text2text-generation", ASSISTANT_MODEL_ID, {
        progress_callback: (info: AssistantModelProgress) => {
          onProgress?.(info);
        }
      })) as Text2TextPipeline;

      pipelineInstance = pipe;
      modelReady = true;
      return pipe;
    } catch (e) {
      pipelinePromise = null;
      throw wrapLoadError(e);
    }
  })();

  return pipelinePromise;
}

export function isAssistantModelReady(): boolean {
  return modelReady;
}

export async function downloadAssistantModel(onProgress?: (p: AssistantModelProgress) => void): Promise<void> {
  await loadPipeline(onProgress);
}

export async function polishAssistantText(question: string, coreAnswer: string): Promise<string> {
  const trimmed = coreAnswer.trim();
  if (!trimmed) return coreAnswer;

  const pipe = await loadPipeline();
  const prompt =
    "Rewrite the following POS help text in polite Turkish. Do not change numbers or facts.\n\n" +
    `Question: ${question.slice(0, 200)}\n\nText:\n${trimmed.slice(0, 1200)}`;

  const out = await pipe(prompt, { max_new_tokens: 180 });
  const text = out?.[0]?.generated_text?.trim();
  if (!text || text.length < 8) return coreAnswer;
  if (text.length > trimmed.length * 3) return coreAnswer;
  return text;
}

export function resetAssistantModelState(): void {
  pipelineInstance = null;
  pipelinePromise = null;
  modelReady = false;
}
