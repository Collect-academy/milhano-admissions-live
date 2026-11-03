import type { CurrentAppUser } from "@/lib/auth";

/** Only these explicitly designated admins may remove populated psychology records. */
export function isFormato3DeletionAdmin(user: Pick<CurrentAppUser, "role" | "username">): boolean {
  return user.role === "admin" && (user.username === "MonaCashflow" || user.username === "CinthiaEsquivel");
}

export function isEmptyFormato3Draft(record: { completion_status: string; payload: unknown; has_ever_content?: boolean }): boolean {
  if (record.has_ever_content !== false || record.completion_status !== "empty" || !record.payload || typeof record.payload !== "object" || Array.isArray(record.payload)) return false;
  const p = record.payload as Record<string, unknown>;
  if (String(p.editor_version ?? "") !== "1") return false;
  if (Object.keys(p).some(key => !["editor_version", "document_title", "content_html", "content_text"].includes(key))) return false;
  if (typeof p.document_title === "string" && p.document_title.trim()) return false;
  if (typeof p.content_text === "string" && p.content_text.trim()) return false;
  // Status is computed by the DB from the HTML, but check it here too.
  return typeof p.content_html !== "string" || !p.content_html.replace(/<[^>]*>/g, "").replace(/&nbsp;|&#160;/gi, " ").trim();
}
