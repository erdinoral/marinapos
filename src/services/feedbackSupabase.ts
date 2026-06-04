import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { FeedbackReplyItem, FeedbackSubmitInput } from "../types/models";
import { parseFeedbackStatus } from "../utils/feedbackStatus";
import { type SupabaseLicenseConfig, resolveAppCode } from "./licenseSupabase";

const FEEDBACK_BUCKET = "feedback-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type { FeedbackReplyItem, FeedbackSubmitInput };

type FeedbackReplyRow = {
  id: string;
  created_at: string;
  title: string;
  body: string;
  contact_name: string;
  status: string | null;
  admin_reply: string | null;
  replied_at: string | null;
};

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80) || "image";
}

export async function submitAppFeedback(cfg: SupabaseLicenseConfig, input: FeedbackSubmitInput): Promise<{ id: string }> {
  const client = createClient(cfg.url.trim(), cfg.anonKey.trim(), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const appCode = resolveAppCode(cfg);
  const title = String(input.title ?? "").trim();
  const body = String(input.body ?? "").trim();
  const contactName = String(input.contactName ?? "").trim();
  if (!title) throw new Error("Baslik gerekli.");
  if (!body) throw new Error("Sorun / aciklama gerekli.");
  if (!contactName) throw new Error("Isim gerekli.");

  let imagePath: string | null = null;
  if (input.image?.base64) {
    const buf = Buffer.from(input.image.base64, "base64");
    if (buf.length > MAX_IMAGE_BYTES) {
      throw new Error("Gorsel en fazla 5 MB olabilir.");
    }
    const mime = String(input.image.mimeType || "image/jpeg").trim();
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : mime.includes("gif") ? "gif" : "jpg";
    const objectPath = `${appCode}/${randomUUID()}-${safeFileName(input.image.fileName || `upload.${ext}`)}`;
    const { error: upErr } = await client.storage.from(FEEDBACK_BUCKET).upload(objectPath, buf, {
      contentType: mime,
      upsert: false
    });
    if (upErr) {
      console.warn("[feedback] Gorsel yuklenemedi, metin kaydi devam:", upErr.message);
      imagePath = null;
    } else {
      imagePath = objectPath;
    }
  }

  const accountEmail = String(input.accountEmail ?? "").trim().toLowerCase() || null;
  const baseRpc = {
    p_app_code: appCode,
    p_app_version: String(input.appVersion ?? "").trim() || null,
    p_title: title,
    p_body: body,
    p_contact_name: contactName,
    p_company_name: String(input.companyName ?? "").trim() || null,
    p_image_path: imagePath
  };

  let data: unknown;
  let error: { message: string } | null = null;

  if (accountEmail) {
    const withEmail = await client.rpc("submit_app_feedback", { ...baseRpc, p_account_email: accountEmail });
    data = withEmail.data;
    error = withEmail.error;
    if (error && isRpcSignatureMismatch(error.message)) {
      const legacy = await client.rpc("submit_app_feedback", baseRpc);
      data = legacy.data;
      error = legacy.error;
    }
  } else {
    const res = await client.rpc("submit_app_feedback", baseRpc);
    data = res.data;
    error = res.error;
  }

  if (error) {
    throw new Error(formatFeedbackSubmitError(error.message));
  }
  const id = String(data ?? "").trim();
  if (!id) {
    throw new Error("Gorus kaydedildi ancak sunucu kayit numarasi donmedi. Supabase RPC kontrol edin.");
  }
  return { id };
}

/** Eski Supabase: submit_app_feedback 7 parametre; yeni: 8 (account_email) */
function isRpcSignatureMismatch(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("could not find the function") ||
    m.includes("function public.submit_app_feedback") ||
    m.includes("schema cache") ||
    m.includes("p_account_email") ||
    (m.includes("submit_app_feedback") && m.includes("does not exist"))
  );
}

function formatFeedbackSubmitError(raw: string): string {
  const m = raw.trim();
  if (/jwt|invalid api key|apikey/i.test(m)) {
    return "Supabase anahtari gecersiz. Kurulumdaki supabase-license.json dosyasini kontrol edin.";
  }
  if (/row-level security|rls|policy/i.test(m)) {
    return `Gorus kaydedilemedi (guvenlik kurali). Supabase'de feedback-rls-fix.sql calistirin. Detay: ${m}`;
  }
  if (/bucket|storage|feedback-images/i.test(m)) {
    return `Gorsel yuklenemedi veya depolama ayari eksik. Gorseli kaldirip tekrar deneyin. Detay: ${m}`;
  }
  if (/network|fetch failed|timeout|enotfound|econnrefused/i.test(m)) {
    return "Internet baglantisi veya Supabase adresine erisim yok. Ag / firewall kontrol edin.";
  }
  if (isRpcSignatureMismatch(m)) {
    return `Gorus RPC uyumsuz. Supabase'de feedback-account-migration.sql calistirin. Detay: ${m}`;
  }
  return m || "Gorus gonderilemedi.";
}

export async function listAppFeedbackReplies(
  cfg: SupabaseLicenseConfig,
  companyName: string
): Promise<FeedbackReplyItem[]> {
  const client = createClient(cfg.url.trim(), cfg.anonKey.trim(), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const appCode = resolveAppCode(cfg);
  const company = String(companyName ?? "").trim();
  if (!company) return [];

  const { data, error } = await client.rpc("get_app_feedback_replies", {
    p_app_code: appCode,
    p_company_name: company
  });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as FeedbackReplyRow[];
  return rows.map((row) => ({
    id: String(row.id),
    createdAt: String(row.created_at ?? ""),
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    contactName: String(row.contact_name ?? ""),
    status: parseFeedbackStatus(row.status),
    adminReply: String(row.admin_reply ?? ""),
    repliedAt: row.replied_at ? String(row.replied_at) : null
  }));
}

export async function listAppFeedbackForAccount(
  cfg: SupabaseLicenseConfig,
  accountEmail: string
): Promise<FeedbackReplyItem[]> {
  const client = createClient(cfg.url.trim(), cfg.anonKey.trim(), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const email = String(accountEmail ?? "").trim().toLowerCase();
  if (!email) return [];

  const { data, error } = await client.rpc("get_app_feedback_for_account", {
    p_app_code: resolveAppCode(cfg),
    p_account_email: email
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("get_app_feedback_for_account") || msg.includes("does not exist")) {
      return [];
    }
    throw new Error(error.message);
  }
  const rows = (data ?? []) as FeedbackReplyRow[];
  return rows.map((row) => ({
    id: String(row.id),
    createdAt: String(row.created_at ?? ""),
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    contactName: String(row.contact_name ?? ""),
    status: parseFeedbackStatus(row.status),
    adminReply: String(row.admin_reply ?? ""),
    repliedAt: row.replied_at ? String(row.replied_at) : null
  }));
}
