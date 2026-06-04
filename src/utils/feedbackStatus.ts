import type { FeedbackStatus } from "../types/models";

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, { text: string; className: string }> = {
  new: { text: "Yeni", className: "is-new" },
  read: { text: "Okundu", className: "is-read" },
  in_progress: { text: "Yapım aşamasında", className: "is-progress" },
  answered: { text: "Yanıtlandı", className: "is-answered" },
  closed: { text: "Kapandı", className: "is-closed" }
};

function normalizeStatusRaw(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/_/g, " ");
}

export function parseFeedbackStatus(raw: string | null | undefined): FeedbackStatus {
  const s = normalizeStatusRaw(raw);
  if (!s) return "new";

  if (s === "new" || s === "yeni") return "new";
  if (s === "read" || s === "okundu") return "read";
  if (s === "in progress" || s === "in_progress" || s === "yapim asamasinda" || s.includes("yap") && s.includes("asam")) {
    return "in_progress";
  }
  if (
    s === "answered" ||
    s === "replied" ||
    s === "resolved" ||
    s === "yanitlandi" ||
    s.includes("yanit")
  ) {
    return "answered";
  }
  if (s === "closed" || s === "kapandi" || s.includes("kapan")) return "closed";

  return "new";
}

export function feedbackStatusTag(status: FeedbackStatus) {
  return FEEDBACK_STATUS_LABELS[status] ?? FEEDBACK_STATUS_LABELS.new;
}
